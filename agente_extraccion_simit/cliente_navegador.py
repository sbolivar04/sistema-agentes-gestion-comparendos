import logging
import asyncio
import re
from datetime import datetime
from typing import List
from playwright.async_api import async_playwright

from agente_extraccion_simit.modelos import (
    ResultadoConsultaSchema,
    TipoConsulta,
    ComparendoSchema,
)
from agente_extraccion_simit.analizador import parse_currency, parse_datetime
from agente_extraccion_simit.motor_descuentos import calculate_discounts

logger = logging.getLogger(__name__)

class ClienteNavegadorSimit:

    """
    Cliente de navegación automatizada con Playwright para extraer datos reales del portal SIMIT en vivo.
    Abre el navegador en modo MAXIMIZADO en pantalla y espera adecuadamente la carga Angular.
    """

    def __init__(self, headless: bool = False):
        self.headless = headless
        self.simit_url = "https://www.fcm.org.co/simit/"

    async def _launch_browser(self, p):
        """Lanza el navegador Chromium optimizado para entorno visual o modo headless (GitHub Actions / Linux)."""
        args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"]
        if not self.headless:
            args.append("--start-maximized")

        canales = [None] if self.headless else ["chrome", "msedge", None]

        for channel in canales:
            try:
                launch_kwargs = {
                    "headless": self.headless,
                    "slow_mo": 0 if self.headless else 300,
                    "args": args
                }
                if channel:
                    logger.info(f"Abriendo navegador {channel.upper()} MAXIMIZADO en pantalla...")
                    launch_kwargs["channel"] = channel
                else:
                    logger.info(f"Abriendo Chromium (headless={self.headless})...")
                
                browser = await p.chromium.launch(**launch_kwargs)
                return browser
            except Exception as e:
                logger.warning(f"No se pudo lanzar navegador con canal '{channel}': {e}")
        
        raise RuntimeError("No se pudo iniciar ningún navegador para la extracción.")

    async def consultar_en_vivo_async(self, criterio: str, tipo_consulta: str) -> ResultadoConsultaSchema:
        # Sanitizar el criterio quitando guiones, espacios o prefijos como '--' para SIMIT
        criterio_clean = re.sub(r'[^A-Z0-9]', '', str(criterio).upper())
        logger.info(f"Navegando a SIMIT en vivo ({tipo_consulta}: {criterio_clean})...")

        comparendos_extraidos: List[ComparendoSchema] = []
        error_msg = None

        async with async_playwright() as p:
            try:
                browser = await self._launch_browser(p)
                # no_viewport=True permite usar todo el tamaño real de la pantalla maximizada
                context = await browser.new_context(
                    no_viewport=True,
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
                )
                page = await context.new_page()

                # ---- OPCIÓN 1: INTERCEPTAR TRÁFICO DE RED (API SIMIT) ----
                api_consulta_json = None
                
                async def handle_response(response):
                    nonlocal api_consulta_json
                    if "estadocuenta/consulta" in response.url:
                        if response.status == 200:
                            try:
                                api_consulta_json = await response.json()
                                logger.info("¡Respuesta interna de la API de SIMIT interceptada exitosamente!")
                            except Exception:
                                pass
                
                page.on("response", handle_response)

                # 1. Cargar portal oficial de SIMIT completamente (esperar networkidle)
                logger.info("Cargando portal SIMIT completamente...")
                max_intentos_carga = 3
                for intento_carga in range(1, max_intentos_carga + 1):
                    try:
                        await page.goto(self.simit_url, wait_until="networkidle", timeout=60000)
                        logger.info("Página inicial de SIMIT cargada 100% en el navegador.")
                        break
                    except Exception as e:
                        if intento_carga < max_intentos_carga:
                            logger.warning(f"[Intento {intento_carga}/{max_intentos_carga}] Error al cargar la página: {str(e).splitlines()[0]}. Reintentando...")
                            await page.wait_for_timeout(3000)
                        else:
                            logger.error(f"Fallo definitivo al cargar SIMIT tras {max_intentos_carga} intentos.")
                            raise e

                # Pausa para asegurar renderizado visual de la portada
                await page.wait_for_timeout(2000)

                # 2. Cerrar modales iniciales si interrumpe la pantalla
                try:
                    close_buttons = await page.query_selector_all("button.modal-info-close, #modalInformation button.close, .modal.show button.close, button.close")
                    for btn in close_buttons:
                        if await btn.is_visible():
                            await btn.click()
                            logger.info("Modal informativo inicial cerrado.")
                    await page.keyboard.press("Escape")
                except Exception:
                    pass

                # 3. Flujo de consulta con verificación de carga y reintentos (Reload si se congela SIMIT)
                input_selector = "input#txtBusqueda, input[name='txtBusqueda'], input[placeholder*='documento'], input[placeholder*='Placa']"
                max_intentos = 3
                busqueda_exitosa = False

                for intento in range(1, max_intentos + 1):
                    logger.info(f"[Intento {intento}/{max_intentos}] Ingresando criterio '{criterio_clean}' en el buscador SIMIT...")
                    
                    try:
                        await page.wait_for_selector(input_selector, state="visible", timeout=15000)
                    except Exception:
                        logger.warning(f"[Intento {intento}] El input de búsqueda no estuvo disponible. Recargando página...")
                        await page.reload(wait_until="networkidle", timeout=40000)
                        await page.wait_for_timeout(3000)
                        continue

                    await page.fill(input_selector, "")
                    await page.fill(input_selector, criterio_clean)
                    await page.wait_for_timeout(800)
                    
                    api_consulta_json = None # Resetear la variable interceptada antes de consultar

                    btn_consultar = await page.query_selector("button#btnConsultar, button[type='submit'], .btn-consultar, button:has-text('Consultar')")
                    if btn_consultar and await btn_consultar.is_visible():
                        await btn_consultar.click(force=True)
                        logger.info(f"[Intento {intento}] Clic en botón 'Consultar' realizado.")
                    else:
                        await page.press(input_selector, "Enter")
                        logger.info(f"[Intento {intento}] Consulta enviada mediante tecla Enter.")

                    # INICIO DEL CRONÓMETRO DE 15 SEGUNDOS DESPUÉS DE DAR CLIC EN BUSCAR
                    logger.info(f"[Intento {intento}] Consulta enviada. Esperando hasta 15 segundos a que SIMIT renderice la respuesta...")
                    
                    render_ok = False
                    es_vacio = False
                    for seg in range(1, 16): # 15 segundos estrictos post-clic
                        await page.wait_for_timeout(1000)
                        
                        # ¿Apareció el modal de múltiples resultados (Nit/Cédula)?
                        modals = await page.query_selector_all(".modal-content, .modal-dialog, dialog")
                        modal_detectado = False
                        for m in modals:
                            if await m.is_visible():
                                texto_modal = await m.inner_text()
                                if "varios resultados" in texto_modal or "Selecciona el que desees" in texto_modal:
                                    logger.info("SIMIT solicita aclarar el tipo de documento (Múltiples resultados).")
                                    await self._handle_disambiguation_modal(page, criterio_clean, m)
                                    modal_detectado = True
                                    break
                                    
                        if modal_detectado:
                            continue

                        # ¿Aparecieron filas de comparendos en la tabla?
                        rows_found = await page.query_selector_all("mat-table mat-row, table tbody tr, tr.mat-row")
                        if len(rows_found) > 0:
                            render_ok = True
                            busqueda_exitosa = True
                            logger.info(f"[Intento {intento}] ¡Tabla de comparendos renderizada a los {seg} segundos!")
                            break

                        # ¿SIMIT desplegó un mensaje oficial dentro del contenedor de resultados?
                        result_container = await page.query_selector("app-comparendos, #mainView, .main-layout-content, .alert, .estado-cuenta")
                        if result_container:
                            res_text = (await result_container.inner_text()).lower()
                            if any(msg in res_text for msg in ["no tiene comparendos", "no tienes comparendos", "sin comparendos", "no se encontraron", "no registra comparendos"]):
                                render_ok = True
                                busqueda_exitosa = True
                                es_vacio = True
                                logger.info(f"[Intento {intento}] SIMIT confirma oficialmente por texto a los {seg}s: No existen comparendos registrados para {criterio_clean}.")
                                break
                                
                        # OPCIÓN 1: ¿La API interna de SIMIT ya respondió que está vacío?
                        if api_consulta_json is not None:
                            multas = api_consulta_json.get("multas", [])
                            comps = api_consulta_json.get("comparendos", [])
                            resols = api_consulta_json.get("resoluciones", [])
                            if len(multas) == 0 and len(comps) == 0 and len(resols) == 0:
                                render_ok = True
                                busqueda_exitosa = True
                                es_vacio = True
                                logger.info(f"[Intento {intento}] API SIMIT confirma internamente a los {seg}s: 0 multas/comparendos para {criterio_clean}.")
                                break

                    if render_ok:
                        break
                    else:
                        logger.warning(f"[Intento {intento}] Transcurrieron 15 segundos sin que SIMIT terminara de cargar la respuesta. Refrescando página y reintentando...")
                        await page.reload(wait_until="networkidle", timeout=40000)
                        await page.wait_for_timeout(3000)

                if not busqueda_exitosa:
                    error_msg = f"SIMIT no respondió correctamente tras {max_intentos} intentos. Posible caída del portal oficial."
                    logger.error(error_msg)
                    await browser.close()
                    return ResultadoConsultaSchema(
                        criterio_busqueda=criterio_clean,
                        tipo_consulta=TipoConsulta.NIT if tipo_consulta == "NIT" else TipoConsulta.PLACA,
                        exitoso=False,
                        total_comparendos=0,
                        total_valor_total=0.0,
                        total_valor_con_descuento_vigente=0.0,
                        comparendos=[],
                        mensaje_error=error_msg
                    )

                if es_vacio:
                    logger.info("Extracción finalizada (0 comparendos). Pausa visual de 3 segundos...")
                    await page.wait_for_timeout(3000)
                    await browser.close()
                    return ResultadoConsultaSchema(
                        criterio_busqueda=criterio_clean,
                        tipo_consulta=TipoConsulta.NIT if tipo_consulta == "NIT" else TipoConsulta.PLACA,
                        exitoso=True,
                        total_comparendos=0,
                        total_valor_total=0.0,
                        total_valor_con_descuento_vigente=0.0,
                        comparendos=[],
                        mensaje_error=None
                    )

                # 4. EXTRACCIÓN ROBUSTA EN DOS PASOS: TABLA PRINCIPAL Y VISTA DETALLADA
                logger.info("Analizando elementos visuales de la página en búsqueda de comparendos...")

                results_table = await page.query_selector("mat-table, table.table, table, .mat-elevation-z8")
                if results_table:
                    rows = await results_table.query_selector_all("tbody tr, mat-row, tr.mat-row")
                else:
                    rows = await page.query_selector_all("table tbody tr, mat-table mat-row, tr.mat-row")
                
                logger.info("Verificando cantidad de registros principales...")

                comp_set = set()

                for idx in range(len(rows)):
                    # Re-obtener las filas vigentes para evitar referencias desactualizadas tras la navegación
                    rows_current = await page.query_selector_all("table tbody tr, mat-table mat-row, tr.mat-row, .mat-row, div[role='row']")
                    if idx >= len(rows_current):
                        break
                    row = rows_current[idx]

                    tds = await row.query_selector_all("td, mat-cell, .mat-cell, div[role='gridcell']")
                    if len(tds) < 5:
                        continue

                    col0_text = (await tds[0].inner_text()).strip()
                    num_comp_match = re.search(r'\b[A-Z0-9\-]{6,25}\b', col0_text)
                    if not num_comp_match:
                        continue
                    num_raw = num_comp_match.group(0)

                    if num_raw in comp_set or "6026800" in num_raw or "413588" in num_raw:
                        continue
                    comp_set.add(num_raw)

                    # El número capturado en la columna 0 de la tabla de SIMIT corresponde al Número de Resolución
                    num_resolucion_val = num_raw
                    num_comp = num_raw # Fallback inicial hasta ingresar al detalle

                    # Obtener valor e intereses
                    valor_val = 0.0
                    intereses_val = 0.0
                    
                    if len(tds) > 6:
                        texto_valor = await tds[6].inner_text()
                        valor_val = parse_currency(texto_valor)
                        match_int = re.search(r'Inter[eé]s\s*\$?\s*([\d\.]+)', texto_valor, re.IGNORECASE)
                        if match_int:
                            try:
                                intereses_val = float(match_int.group(1).replace(".", ""))
                            except: pass

                    if valor_val == 0.0 and len(tds) > 7:
                        texto_valor = await tds[7].inner_text()
                        valor_val = parse_currency(texto_valor)
                        match_int = re.search(r'Inter[eé]s\s*\$?\s*([\d\.]+)', texto_valor, re.IGNORECASE)
                        if match_int:
                            try:
                                intereses_val = float(match_int.group(1).replace(".", ""))
                            except: pass

                    valor_total_calc = valor_val + intereses_val

                    # Determinar si es Multa o Comparendo (y extraer fecha de resolución si es multa)
                    tipo_registro_val = "Comparendo"
                    if "Multa" in col0_text:
                        tipo_registro_val = "Multa"

                    # Extraer datos iniciales de la fila
                    fecha_val = parse_datetime(col0_text) or datetime.now()
                    
                    fecha_notif = None
                    fecha_resolucion_val = None
                    
                    if tipo_registro_val == "Multa":
                        match_fecha = re.search(r'Fecha resoluci[oó]n:\s*(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})', col0_text)
                        if match_fecha:
                            fecha_resolucion_val = parse_datetime(match_fecha.group(1))
                        else:
                            fecha_resolucion_val = parse_datetime(col0_text)

                    placa_val = (await tds[2].inner_text()).strip() if len(tds) > 2 else (criterio_clean if len(criterio_clean) <= 6 else "DESCONOCIDA")
                    sec_text = (await tds[3].inner_text()).strip() if len(tds) > 3 else "SECRETARIA DE TRANSITO"
                    sec_val = f"Secretaría de {sec_text}" if sec_text and "Secretaria" not in sec_text else sec_text
                    
                    col4_str = (await tds[4].inner_text()).strip() if len(tds) > 4 else ""
                    cod_match = re.search(r'\b[A-Z]\d{2}\b', col4_str)
                    codigo_inf = cod_match.group(0) if cod_match else "COMPARENDO"
                    desc_inf = f"Infracción {codigo_inf} reportada en SIMIT"
                    es_foto = "fotodetección" in col4_str.lower() or "fotomulta" in col4_str.lower()
                    
                    direccion_val = None
                    fuente_val = None

                    # Buscar enlace del comparendo para ingresar a la vista 'Detalle'
                    link_elem = await tds[0].query_selector("a, button, [role='link']")
                    if not link_elem:
                        link_elem = await row.query_selector("a, button, [role='link']")
                    if not link_elem:
                        link_elem = await page.query_selector(f"a:has-text('{num_raw}'), button:has-text('{num_raw}')")

                    if link_elem:
                        try:
                            logger.info(f"Navegando a la vista detallada del comparendo (Resolución {num_resolucion_val})...")
                            await link_elem.click()
                            await page.wait_for_timeout(3500)

                            # Extraer datos detallados de la tarjeta 'Información comparendo' mediante inspección de columnas
                            detalle_data = await page.evaluate('''() => {
                                const res = {};
                                // Localizar la tarjeta específica de Información comparendo para evitar pies de página
                                const cards = Array.from(document.querySelectorAll('mat-card, .card, app-detalle-comparendo, div'));
                                const card = cards.find(el => el.innerText && el.innerText.includes('Información comparendo')) || document.body;

                                // Analizar cada columna de información en la cuadrícula
                                const cols = Array.from(card.querySelectorAll('div[class*="col"], div.col, div.col-md-3, div.col-md-4, div.col-12, div.col-sm-6'));
                                for (const col of cols) {
                                    const lines = col.innerText.split('\\n').map(l => l.trim()).filter(Boolean);
                                    if (lines.length >= 2) {
                                        const label = lines[0].toLowerCase();
                                        const val = lines[1];
                                        if ((label.includes('no. comparendo') || label.includes('no comparendo')) && !res.numero) res.numero = val;
                                        else if (label === 'fecha' && !res.fecha) res.fecha = val;
                                        else if (label === 'hora' && !res.hora) res.hora = val;
                                        else if ((label.includes('dirección') || label.includes('direccion')) && !res.direccion && !val.toLowerCase().includes('lunes')) res.direccion = val;
                                        else if (label.includes('fuente comparendo') && !res.fuente) res.fuente = val;
                                        else if ((label.includes('secretaría') || label.includes('secretaria')) && !res.secretaria) res.secretaria = val;
                                        else if ((label.includes('código') || label.includes('codigo')) && !res.codigo) res.codigo = val;
                                        else if ((label.includes('descripción') || label.includes('descripcion')) && !res.descripcion) res.descripcion = val;
                                        else if (label === 'placa' && !res.placa) res.placa = val;
                                        else if (label.includes('fecha notificación') || label.includes('fecha notificacion')) res.fecha_notificacion = val;
                                    }
                                }
                                return res;
                            }''')

                            if detalle_data:
                                if detalle_data.get("numero"):
                                    num_comp_det = re.search(r'\b[A-Z0-9\-]{6,25}\b', detalle_data["numero"])
                                    if num_comp_det:
                                        num_comp = num_comp_det.group(0)
                                if detalle_data.get("direccion") and "lunes" not in detalle_data["direccion"].lower() and "horario" not in detalle_data["direccion"].lower():
                                    direccion_val = detalle_data["direccion"]
                                if detalle_data.get("fuente"):
                                    fuente_val = detalle_data["fuente"]
                                if detalle_data.get("secretaria"):
                                    sec_val = detalle_data["secretaria"]
                                if detalle_data.get("codigo"):
                                    cod_found = re.search(r'\b[A-Z]\d{2}\b', detalle_data["codigo"])
                                    if cod_found:
                                        codigo_inf = cod_found.group(0)
                                if detalle_data.get("descripcion") and len(detalle_data["descripcion"]) > 5:
                                    desc_inf = detalle_data["descripcion"]
                                if detalle_data.get("placa") and len(detalle_data["placa"]) >= 5:
                                    placa_val = detalle_data["placa"].upper()

                                fecha_str_det = detalle_data.get("fecha")
                                hora_str_det = detalle_data.get("hora")

                                if fecha_str_det:
                                    full_dt_str = f"{fecha_str_det} {hora_str_det}" if hora_str_det else fecha_str_det
                                    parsed_f = parse_datetime(full_dt_str)
                                    if parsed_f:
                                        fecha_val = parsed_f
                                    logger.info(f"Vista Detalle extraída -> Res: {num_resolucion_val}, Comparendo: {num_comp}, Fecha: {fecha_str_det}, Hora: {hora_str_det}, Dirección: {direccion_val}")

                                if detalle_data.get("fecha_notificacion"):
                                    parsed_f_notif = parse_datetime(detalle_data["fecha_notificacion"])
                                    if parsed_f_notif:
                                        fecha_notif = parsed_f_notif

                            # Hacer clic en el botón 'Volver' para retornar a la lista
                            volver_btn = await page.query_selector("button:has-text('Volver'), .btn-volver, a:has-text('Volver')")
                            if volver_btn:
                                await volver_btn.click()
                                await page.wait_for_timeout(2500)
                            else:
                                await page.go_back()
                                await page.wait_for_timeout(2500)
                        except Exception as ex_detail:
                            logger.warning(f"No se pudo acceder a la vista detallada de {num_resolucion_val}: {ex_detail}")

                    comp = ComparendoSchema(
                        numero_resolucion=num_resolucion_val,
                        numero_comparendo=num_comp,
                        fecha_infraccion=fecha_val,
                        fecha_notificacion=fecha_notif,
                        fecha_resolucion=fecha_resolucion_val,
                        placa=placa_val,
                        criterio_busqueda=criterio_clean,
                        codigo_infraccion=codigo_inf,
                        descripcion_infraccion=desc_inf,
                        secretaria=sec_val,
                        direccion=direccion_val,
                        fuente_comparendo=fuente_val,
                        valor=valor_val,
                        intereses=intereses_val,
                        valor_total=valor_total_calc,
                        es_fotodeteccion=es_foto,
                        tipo_registro=tipo_registro_val
                    )
                    comparendos_extraidos.append(comp)

                # Pausa final visible de 3 segundos para apreciación visual
                logger.info(f"Se extrajeron {len(comparendos_extraidos)} comparendos/multas reales en la tabla SIMIT.")
                logger.info("Extracción finalizada. Pausa visual de 3 segundos...")
                await page.wait_for_timeout(3000)
                await browser.close()

            except Exception as e:
                error_msg = f"Error durante la extracción visual en SIMIT: {str(e)}"
                logger.error(error_msg)

        # 7. Enriquecer comparendos extraídos con el Motor de Descuentos
        comparendos_enriquecidos = [calculate_discounts(c) for c in comparendos_extraidos]

        total_nominal = sum(c.valor_total for c in comparendos_enriquecidos)
        total_con_descuento = sum(
            c.valor_con_descuento_50 if c.aplica_descuento_50 
            else (c.valor_con_descuento_25 if c.aplica_descuento_25 else c.valor_total)
            for c in comparendos_enriquecidos
        )

        return ResultadoConsultaSchema(
            criterio_busqueda=criterio_clean,
            tipo_consulta=TipoConsulta.NIT if tipo_consulta == "NIT" else TipoConsulta.PLACA,
            exitoso=(error_msg is None),
            total_comparendos=len(comparendos_enriquecidos),
            total_valor_total=total_nominal,
            total_valor_con_descuento_vigente=total_con_descuento,
            comparendos=comparendos_enriquecidos,
            mensaje_error=error_msg
        )

    def consultar_en_vivo(self, criterio: str, tipo_consulta: str) -> ResultadoConsultaSchema:
        """Wrapper síncrono para ejecutar la extracción con Playwright."""
        return asyncio.run(self.consultar_en_vivo_async(criterio, tipo_consulta))

    async def _handle_disambiguation_modal(self, page, criterio: str, modal=None):
        """Maneja el modal de SIMIT cuando encuentra múltiples documentos (ej. NIT y Cédula) para el mismo número."""
        if not modal:
            modal = await page.query_selector(".modal-content:has(#modalMultiplesPersonas)")
            if not modal:
                modal = page
            
        radios = await modal.query_selector_all("input[type='radio']")
        opciones = []
        for r in radios:
            # Obtener el texto asociado al radio button
            label_text = await r.evaluate("(el) => el.parentElement.innerText || el.nextElementSibling.innerText || ''")
            opciones.append((r, label_text.strip()))
            
        if not opciones:
            logger.warning("Modal detectado pero no se hallaron opciones (radio buttons).")
            return
            
        from base_datos.conexion import get_db_session
        from base_datos.repositorio import DatabaseRepository
        
        opcion_elegida = None
        
        with get_db_session() as session:
            repo = DatabaseRepository(session)
            pref = repo.get_preferencia_documento(criterio)
            
            if pref:
                for r, label in opciones:
                    if pref.lower() in label.lower():
                        opcion_elegida = r
                        logger.info(f"Usando preferencia guardada '{pref}' para el documento {criterio}.")
                        break
                        
            if not opcion_elegida:
                print("\n" + "="*80)
                print(f" [SIMIT] REQUIERE ATENCIÓN MANUAL: MÚLTIPLES RESULTADOS PARA '{criterio}'")
                print(" SIMIT encontró varias entidades asociadas a este número. Seleccione la correcta:")
                for i, (r, label) in enumerate(opciones, 1):
                    # Limpiar saltos de línea para mostrar bonito
                    clean_label = label.replace('\n', ' - ')
                    print(f"   {i}. {clean_label}")
                print("="*80)
                
                seleccion = None
                while not seleccion:
                    resp = await asyncio.to_thread(input, "\n>>> Ingrese el número de la opción correcta (ej. 1 o 2): ")
                    try:
                        idx = int(resp.strip()) - 1
                        if 0 <= idx < len(opciones):
                            seleccion = opciones[idx]
                        else:
                            print(" Opción inválida. Intente de nuevo.")
                    except:
                        print(" Por favor ingrese un número válido.")
                        
                opcion_elegida, label_elegido = seleccion
                
                tipo_a_guardar = "Desconocida"
                if "Nit" in label_elegido or "NIT" in label_elegido:
                    tipo_a_guardar = "Nit"
                elif "Cédula" in label_elegido or "Cedula" in label_elegido:
                    tipo_a_guardar = "Cédula"
                    
                repo.save_preferencia_documento(criterio, tipo_a_guardar)
                logger.info(f"Se guardó la preferencia '{tipo_a_guardar}' en la BD para futuras consultas.")
                
        # Seleccionar la opción elegida (usamos evaluate para mayor confiabilidad en custom-radios)
        await opcion_elegida.evaluate("(el) => el.click()")
        await page.wait_for_timeout(500)
        
        # Hacer clic en Continuar
        btn_continuar = await modal.query_selector("button:has-text('Continuar')")
        if not btn_continuar:
            # fallback
            btn_continuar = await modal.query_selector(".btn-primary")
            
        if btn_continuar:
            await btn_continuar.evaluate("(el) => el.click()")
            logger.info("Se hizo clic en el botón Continuar del modal.")
        else:
            await page.keyboard.press("Enter")
            logger.info("No se encontró el botón Continuar, se presionó Enter.")
            
        logger.info("Opción de documento confirmada. Esperando carga de resultados...")
        await page.wait_for_timeout(2000)


# Alias de compatibilidad
SimitBrowserClient = ClienteNavegadorSimit
