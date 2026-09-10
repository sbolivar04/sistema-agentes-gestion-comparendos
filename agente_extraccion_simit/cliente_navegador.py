import logging
import asyncio
import re
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
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

    async def _extraer_comparendos_de_tabla_actual(self, page, criterio_clean: str) -> List[ComparendoSchema]:
        """
        Extrae todos los comparendos y multas visibles en la tabla de resultados de SIMIT,
        ingresando a la vista 'Detalle' de cada uno para capturar dirección, hora, fuente y datos completos.
        """
        comparendos_extraidos: List[ComparendoSchema] = []
        logger.info(f"Analizando elementos visuales de la página en búsqueda de comparendos para {criterio_clean}...")

        results_table = await page.query_selector("mat-table, table.table, table, .mat-elevation-z8")
        if results_table:
            rows = await results_table.query_selector_all("tbody tr, mat-row, tr.mat-row")
        else:
            rows = await page.query_selector_all("table tbody tr, mat-table mat-row, tr.mat-row")
        
        logger.info(f"Verificando cantidad de registros principales para {criterio_clean}...")

        comp_set = set()

        for idx in range(len(rows)):
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

            num_resolucion_val = num_raw
            num_comp = num_raw

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

            tipo_registro_val = "Comparendo"
            if "Multa" in col0_text:
                tipo_registro_val = "Multa"

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

                    detalle_data = await page.evaluate('''() => {
                        const res = {};
                        const cards = Array.from(document.querySelectorAll('mat-card, .card, app-detalle-comparendo, div'));
                        const card = cards.find(el => el.innerText && el.innerText.includes('Información comparendo')) || document.body;

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
                    if volver_btn and await volver_btn.is_visible():
                        await volver_btn.click(force=True)
                        await page.wait_for_timeout(2500)
                    else:
                        await page.go_back()
                        await page.wait_for_timeout(2500)
                except Exception as ex_detail:
                    logger.warning(f"No se pudo acceder a la vista detallada de {num_resolucion_val}: {ex_detail}")

            comparendos_extraidos.append(ComparendoSchema(
                numero_comparendo=num_comp,
                numero_resolucion=num_resolucion_val,
                tipo_registro=tipo_registro_val,
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
                es_fotodeteccion=es_foto
            ))

        logger.info(f"Se extrajeron {len(comparendos_extraidos)} comparendos/multas reales en la tabla SIMIT para {criterio_clean}.")
        return comparendos_extraidos

    async def _ejecutar_busqueda_en_pagina(
        self,
        page,
        criterio_clean: str,
        tipo_preferencia: Optional[str] = None,
        api_holder: dict = None,
        max_intentos: int = 3
    ) -> Tuple[bool, List[ComparendoSchema], bool, Optional[str]]:
        """
        Ejecuta un intento de búsqueda en la página actual para un criterio,
        manejando posibles modales de desambiguación con tipo_preferencia.
        Retorna (exitoso, comparendos, modal_detectado, mensaje_error).
        """
        input_selector = "input#txtBusqueda, input[name='txtBusqueda'], input[placeholder*='documento'], input[placeholder*='Placa']"
        busqueda_exitosa = False
        modal_detectado = False

        for intento in range(1, max_intentos + 1):
            logger.info(f"[Intento {intento}/{max_intentos}] Ingresando criterio '{criterio_clean}' (Preferencia: {tipo_preferencia or 'Auto'}) en el buscador SIMIT...")
            
            try:
                input_elem = await page.wait_for_selector(input_selector, state="visible", timeout=12000)
            except Exception:
                logger.warning(f"[Intento {intento}] El input de búsqueda no estuvo disponible. Verificando retorno a la lista...")
                btn_volver = await page.query_selector("button:has-text('Volver'), .btn-volver, a:has-text('Volver')")
                if btn_volver and await btn_volver.is_visible():
                    await btn_volver.click(force=True)
                    await page.wait_for_timeout(2000)
                else:
                    await self._cerrar_anuncios_iniciales(page)
                    await page.goto(self.simit_url, wait_until="domcontentloaded", timeout=25000)
                    await self._cerrar_anuncios_iniciales(page)
                try:
                    input_elem = await page.wait_for_selector(input_selector, state="visible", timeout=12000)
                except Exception as e_inp:
                    logger.error(f"[Intento {intento}] No se pudo acceder al buscador: {e_inp}")
                    continue

            # Asegurar input limpio y enfocado con el nuevo criterio
            await input_elem.click(force=True)
            await input_elem.fill("")
            await input_elem.fill(criterio_clean)
            await page.dispatch_event(input_selector, "input")
            await page.dispatch_event(input_selector, "change")
            await page.wait_for_timeout(500)
            
            if api_holder:
                api_holder["json"] = None

            # En SIMIT el botón oficial de búsqueda tiene id="consultar"
            btn_consultar = await page.query_selector("button#consultar, button[type='submit'], button#btnConsultar, .btn-consultar, button:has-text('Consultar')")
            if btn_consultar and await btn_consultar.is_visible():
                await btn_consultar.click(force=True)
                logger.info(f"[Intento {intento}] Clic en botón de búsqueda 'Consultar' realizado para {criterio_clean}.")
            else:
                await page.press(input_selector, "Enter")
                logger.info(f"[Intento {intento}] Consulta enviada mediante tecla Enter para {criterio_clean}.")

            # Esperar a que el validador de seguridad interno de SIMIT (whcModal) finalice
            logger.info(f"[Intento {intento}] Consulta enviada. Esperando validación de seguridad de SIMIT...")
            for _ in range(16):
                whc = await page.query_selector("#whcModal")
                if whc and await whc.is_visible():
                    await page.wait_for_timeout(500)
                else:
                    break

            # Espera de renderizado de la respuesta
            logger.info(f"[Intento {intento}] Esperando a que SIMIT renderice la respuesta para {criterio_clean}...")
            
            render_ok = False
            es_vacio = False
            for seg in range(1, 26):
                await page.wait_for_timeout(1000)
                
                # ¿Apareció el modal de múltiples resultados (Nit/Cédula)?
                modals_multiples = await page.query_selector_all("#modal-multiples-personas, #modalMultiplesPersonas, .modal.show:has(input[type='radio'])")
                hubo_modal_este_seg = False
                for m in modals_multiples:
                    if await m.is_visible():
                        modal_detectado = True
                        hubo_modal_este_seg = True
                        logger.info(f"SIMIT solicita aclarar el tipo de documento para {criterio_clean} (Preferencia: {tipo_preferencia}).")
                        resuelto = await self._handle_disambiguation_modal(page, criterio_clean, m, tipo_forzado=tipo_preferencia)
                        if not resuelto:
                            return False, [], True, "Requiere configurar si es NIT o Cédula en la plataforma web"
                        if api_holder:
                            api_holder["json"] = None
                        await page.wait_for_timeout(2000)
                        break
                            
                if hubo_modal_este_seg:
                    continue

                # ¿Aparecieron filas de comparendos en la tabla?
                rows_found = await page.query_selector_all("mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row")
                if len(rows_found) > 0:
                    render_ok = True
                    busqueda_exitosa = True
                    logger.info(f"[Intento {intento}] ¡Tabla de comparendos renderizada a los {seg}s ({len(rows_found)} registros encontrados)!")
                    break

                # ¿SIMIT desplegó un mensaje oficial de paz y salvo o sin comparendos?
                result_container = await page.query_selector("app-comparendos, #mainView, .main-layout-content, .alert, .estado-cuenta, .empty-state, body")
                if result_container:
                    res_text = (await result_container.inner_text()).lower()
                    if any(msg in res_text for msg in ["no posee a la fecha pendientes", "no tiene comparendos", "no tienes comparendos", "sin comparendos", "no se encontraron comparendos", "no registra comparendos"]):
                        render_ok = True
                        busqueda_exitosa = True
                        es_vacio = True
                        logger.info(f"[Intento {intento}] SIMIT confirma oficialmente: No existen comparendos registrados para {criterio_clean} ({tipo_preferencia or 'consulta'}).")
                        break
                        
                # Verificación con API interna solo si NO requiere desambiguación de personas
                if seg >= 6 and api_holder and api_holder.get("json") is not None:
                    api_json = api_holder["json"]
                    personas = api_json.get("personasMismoDocumento", [])
                    multas = api_json.get("multas", [])
                    comps = api_json.get("comparendos", [])
                    resols = api_json.get("resoluciones", [])
                    if len(personas) == 0 and len(multas) == 0 and len(comps) == 0 and len(resols) == 0:
                        render_ok = True
                        busqueda_exitosa = True
                        es_vacio = True
                        logger.info(f"[Intento {intento}] API SIMIT confirma internamente a los {seg}s: 0 multas/comparendos para {criterio_clean}.")
                        break

            if render_ok:
                break
            else:
                logger.warning(f"[Intento {intento}] Tiempo de espera agotado sin respuesta clara de SIMIT para {criterio_clean}. Reintentando...")

        if not busqueda_exitosa:
            return False, [], modal_detectado, f"SIMIT no respondió correctamente tras {max_intentos} intentos para {criterio_clean}."

        if es_vacio:
            return True, [], modal_detectado, None

        comparendos = await self._extraer_comparendos_de_tabla_actual(page, criterio_clean)
        return True, comparendos, modal_detectado, None

    async def _consultar_criterio_en_pagina(
        self,
        page,
        criterio: str,
        tipo_consulta: str,
        api_holder: dict = None
    ) -> ResultadoConsultaSchema:
        """
        Ejecuta la consulta de un NIT, Cédula o Placa en una página ya abierta de SIMIT.
        Si la entidad está configurada como 'AMBOS' (o se solicita 'AMBOS'), ejecuta la consulta
        en dos pasadas (NIT y Cédula) si SIMIT detecta ambas identidades, unificando resultados.
        """
        criterio_clean = re.sub(r'[^A-Z0-9]', '', str(criterio).upper())
        logger.info(f"Consultando en portal SIMIT ({tipo_consulta}: {criterio_clean})...")

        # Consultar si en base de datos la entidad está configurada como AMBOS
        pref_bd = None
        try:
            from base_datos.conexion import obtener_sesion_bd
            from base_datos.repositorio import RepositorioBaseDatos
            with obtener_sesion_bd() as sesion:
                repo = RepositorioBaseDatos(sesion)
                pref_bd = repo.obtener_preferencia_documento(criterio_clean)
        except Exception:
            pass

        tipo_solicitado = str(tipo_consulta).strip().upper()
        es_ambos = (tipo_solicitado == "AMBOS") or (pref_bd and pref_bd.strip().upper() == "AMBOS")

        if es_ambos:
            logger.info(f"Modo AMBOS activo para {criterio_clean}: Se consultarán comparendos bajo NIT y Cédula.")
            
            # Pasada 1: Buscar bajo NIT
            exito_nit, comps_nit, modal_visto, err_nit = await self._ejecutar_busqueda_en_pagina(
                page, criterio_clean, tipo_preferencia="NIT", api_holder=api_holder
            )
            
            if not exito_nit and err_nit and "Requiere configurar" in err_nit:
                return ResultadoConsultaSchema(
                    criterio_busqueda=criterio_clean,
                    tipo_consulta=TipoConsulta.AMBOS,
                    exitoso=True,
                    total_comparendos=0,
                    total_valor_total=0.0,
                    total_valor_con_descuento_vigente=0.0,
                    comparendos=[],
                    mensaje_error=err_nit
                )

            comps_totales = list(comps_nit) if exito_nit else []

            # Pasada 2: Buscar bajo Cédula (solo si el modal de desambiguación existe en SIMIT)
            if modal_visto:
                logger.info(f"Modal de múltiples identidades confirmado en SIMIT. Ejecutando Pasada 2 (Cédula) para {criterio_clean}...")
                await page.wait_for_timeout(1500)
                exito_cc, comps_cc, _, err_cc = await self._ejecutar_busqueda_en_pagina(
                    page, criterio_clean, tipo_preferencia="Cédula", api_holder=api_holder
                )
                if exito_cc and comps_cc:
                    logger.info(f"Pasada 2 (Cédula) completada: {len(comps_cc)} registros encontrados.")
                    comps_totales.extend(comps_cc)

            # Desduplicar comparendos
            comparendos_unicos = []
            claves_vistas = set()
            for c in comps_totales:
                clave = c.numero_comparendo or c.numero_resolucion
                if clave:
                    if clave not in claves_vistas:
                        claves_vistas.add(clave)
                        comparendos_unicos.append(c)
                else:
                    comparendos_unicos.append(c)

            comparendos_enriquecidos = [calculate_discounts(c) for c in comparendos_unicos]
            total_nominal = sum(c.valor_total for c in comparendos_enriquecidos)
            total_con_descuento = sum(
                c.valor_con_descuento_50 if c.aplica_descuento_50 
                else (c.valor_con_descuento_25 if c.aplica_descuento_25 else c.valor_total)
                for c in comparendos_enriquecidos
            )

            logger.info(f"Consolidación AMBOS finalizada para {criterio_clean}: {len(comparendos_enriquecidos)} comparendos únicos en total.")
            return ResultadoConsultaSchema(
                criterio_busqueda=criterio_clean,
                tipo_consulta=TipoConsulta.AMBOS,
                exitoso=(exito_nit or bool(comps_totales)),
                total_comparendos=len(comparendos_enriquecidos),
                total_valor_total=total_nominal,
                total_valor_con_descuento_vigente=total_con_descuento,
                comparendos=comparendos_enriquecidos,
                mensaje_error=None if (exito_nit or bool(comps_totales)) else err_nit
            )

        # MODO ESTÁNDAR (UN SOLO TIPO: NIT, Cédula o Placa)
        tipo_pref = tipo_consulta if tipo_consulta in ["NIT", "Cédula"] else pref_bd
        exito, comparendos, _, error_msg = await self._ejecutar_busqueda_en_pagina(
            page, criterio_clean, tipo_preferencia=tipo_pref, api_holder=api_holder
        )

        tipo_enum = TipoConsulta.NIT if (tipo_consulta == "NIT" or criterio_clean.isdigit()) else TipoConsulta.PLACA
        if tipo_consulta in ["Cédula", "CEDULA"]:
            tipo_enum = TipoConsulta.CEDULA

        if not exito:
            return ResultadoConsultaSchema(
                criterio_busqueda=criterio_clean,
                tipo_consulta=tipo_enum,
                exitoso=(error_msg and "Requiere configurar" in error_msg),
                total_comparendos=0,
                total_valor_total=0.0,
                total_valor_con_descuento_vigente=0.0,
                comparendos=[],
                mensaje_error=error_msg
            )

        comparendos_enriquecidos = [calculate_discounts(c) for c in comparendos]
        total_nominal = sum(c.valor_total for c in comparendos_enriquecidos)
        total_con_descuento = sum(
            c.valor_con_descuento_50 if c.aplica_descuento_50 
            else (c.valor_con_descuento_25 if c.aplica_descuento_25 else c.valor_total)
            for c in comparendos_enriquecidos
        )

        return ResultadoConsultaSchema(
            criterio_busqueda=criterio_clean,
            tipo_consulta=tipo_enum,
            exitoso=True,
            total_comparendos=len(comparendos_enriquecidos),
            total_valor_total=total_nominal,
            total_valor_con_descuento_vigente=total_con_descuento,
            comparendos=comparendos_enriquecidos,
            mensaje_error=None
        )

    async def consultar_en_vivo_async(self, criterio: str, tipo_consulta: str) -> ResultadoConsultaSchema:
        """Consulta individual: abre el navegador, consulta el criterio y cierra el navegador."""
        resultados = await self.consultar_lote_en_vivo_async([{"criterio": criterio, "tipo_documento": tipo_consulta}])
        return resultados[0] if resultados else ResultadoConsultaSchema(
            criterio_busqueda=criterio,
            tipo_consulta=TipoConsulta.AMBOS if tipo_consulta == "AMBOS" else (TipoConsulta.NIT if (tipo_consulta == "NIT" or criterio.isdigit()) else TipoConsulta.PLACA),
            exitoso=False,
            total_comparendos=0,
            total_valor_total=0.0,
            total_valor_con_descuento_vigente=0.0,
            comparendos=[],
            mensaje_error="No se obtuvo respuesta del portal"
        )

    async def consultar_lote_en_vivo_async(
        self,
        lista_consultas: List[dict],
        callback_procesamiento=None
    ) -> List[ResultadoConsultaSchema]:
        """
        Consulta masiva optimizada:
        Abre el navegador UNA SOLA VEZ, carga SIMIT y cierra los anuncios iniciales UNA SOLA VEZ.
        Luego, para cada entidad/criterio, reutiliza la misma pestaña modificando únicamente
        la caja de búsqueda superior (#txtBusqueda) y pulsando 'Consultar' sin recargar la página.
        """
        resultados = []
        async with async_playwright() as p:
            browser = await self._launch_browser(p)
            try:
                context_kwargs = {
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
                    "locale": "es-CO",
                    "timezone_id": "America/Bogota",
                    "extra_http_headers": {
                        "Accept-Language": "es-CO,es;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Sec-Ch-Ua": '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                        "Sec-Ch-Ua-Mobile": "?0",
                        "Sec-Ch-Ua-Platform": '"Windows"'
                    }
                }
                if not self.headless:
                    context_kwargs["no_viewport"] = True
                else:
                    context_kwargs["viewport"] = {"width": 1920, "height": 1080}

                context = await browser.new_context(**context_kwargs)
                page = await context.new_page()

                # Interceptar tráfico de red para optimizar respuesta
                api_holder = {"json": None}
                async def handle_response(response):
                    if "estadocuenta/consulta" in response.url and response.status == 200:
                        try:
                            api_holder["json"] = await response.json()
                            logger.info("¡Respuesta interna de la API de SIMIT interceptada exitosamente!")
                        except Exception:
                            pass

                page.on("response", handle_response)

                # 1. Cargar portal oficial de SIMIT UNA SOLA VEZ
                logger.info("Cargando portal SIMIT una sola vez para la sesión masiva...")
                await page.goto(self.simit_url, wait_until="domcontentloaded", timeout=45000)
                await self._cerrar_anuncios_iniciales(page)

                # 2. Consultar secuencialmente cada entidad en la misma pestaña
                for idx, item in enumerate(lista_consultas, 1):
                    criterio = str(item.get("criterio") or item.get("nit") or item.get("placa") or "")
                    tipo_doc = str(item.get("tipo_documento") or item.get("tipo_consulta") or ("NIT" if criterio.isdigit() else "PLACA"))
                    empresa = item.get("empresa") or item.get("nombre_entidad") or criterio

                    logger.info(f"\n[{idx}/{len(lista_consultas)}] Consultando {empresa} ({tipo_doc}: {criterio}) en la misma sesión continua...")
                    resultado = await self._consultar_criterio_en_pagina(page, criterio, tipo_doc, api_holder)
                    resultados.append(resultado)

                    if callback_procesamiento:
                        try:
                            callback_procesamiento(item, resultado)
                        except Exception as e_cb:
                            logger.error(f"Error en callback de procesamiento para {criterio}: {e_cb}")

                return resultados
            finally:
                logger.info("Sesión de extracción masiva completada. Cerrando navegador Chromium...")
                await browser.close()

    def consultar_en_vivo(self, criterio: str, tipo_consulta: str) -> ResultadoConsultaSchema:
        """Wrapper síncrono para ejecutar la extracción individual con Playwright."""
        return asyncio.run(self.consultar_en_vivo_async(criterio, tipo_consulta))

    def consultar_lote_en_vivo(self, lista_consultas: list, callback_procesamiento=None) -> list:
        """Wrapper síncrono para ejecutar la extracción en lote en una sola sesión continua."""
        return asyncio.run(self.consultar_lote_en_vivo_async(lista_consultas, callback_procesamiento))

    async def _cerrar_anuncios_iniciales(self, page):
        """
        Cierra anuncios emergentes, campañas y modales informativos iniciales de SIMIT (ej: #modalInformation).
        Garantiza que el fondo (backdrop) no bloquee la interacción con el buscador.
        """
        logger.info("Verificando y cerrando anuncios o modales informativos iniciales de SIMIT...")
        # Esperar hasta 5 segundos activamente por si el modal informativo de SIMIT tarda en renderizar
        for _ in range(10):
            try:
                # 1. Intentar hacer clic en el botón de cerrar del modal informativo
                close_btn = await page.query_selector("#modalInformation .modal-info-close, #modalInformation button.close, button.modal-info-close, .modal.show button.close, button.close")
                if close_btn and await close_btn.is_visible():
                    await close_btn.click(force=True)
                    logger.info("Anuncio/modal informativo inicial de SIMIT cerrado mediante clic.")
                    await page.wait_for_timeout(600)
                    break
            except Exception:
                pass
            await page.wait_for_timeout(500)

        # 2. Cerrar con teclado Escape
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass

        # 3. Limpieza de seguridad vía DOM para garantizar que ningún backdrop oscuro bloquee la pantalla
        try:
            await page.evaluate('''() => {
                // Eliminar modal informativo si persiste en pantalla
                const modalInfo = document.getElementById("modalInformation");
                if (modalInfo) {
                    modalInfo.classList.remove("show");
                    modalInfo.style.display = "none";
                }
                // Eliminar cualquier backdrop residual de Bootstrap
                const backdrops = document.querySelectorAll(".modal-backdrop");
                backdrops.forEach(b => b.remove());
                document.body.classList.remove("modal-open");
                document.body.style.overflow = "auto";
                
                // Ocultar burbuja flotante de Civii si interfiere
                const civii = document.querySelector(".civii-bubble, .civii-bubble-container");
                if (civii) civii.style.display = "none";
            }''')
        except Exception:
            pass

    async def _handle_disambiguation_modal(
        self,
        page,
        criterio: str,
        modal=None,
        tipo_forzado: Optional[str] = None
    ) -> bool:
        """
        Maneja el modal de SIMIT cuando encuentra múltiples personas/documentos (ej. NIT y Cédula).
        Consulta la tabla entidades_consulta en Supabase para seleccionar la opción configurada,
        o utiliza tipo_forzado si se especifica directamente (necesario en modo AMBOS).
        """
        try:
            if not modal:
                modal = await page.query_selector("#modal-multiples-personas, .modal.show:has(#modalMultiplesPersonas)")
                if not modal:
                    modal = page
                
            radios = await modal.query_selector_all("input[type='radio'], .custom-control-input")
            opciones = []
            for r in radios:
                r_id = await r.get_attribute("id")
                # En Bootstrap custom-control, el texto descriptivo está dentro del label asociado
                lbl = await modal.query_selector(f"label[for='{r_id}']") if r_id else None
                if lbl:
                    label_text = (await lbl.inner_text()).strip()
                else:
                    label_text = await r.evaluate("(el) => el.parentElement.innerText || el.closest('div').innerText || ''")
                opciones.append((r, lbl, label_text))
                
            if not opciones:
                logger.warning("Modal de desambiguación detectado pero no se hallaron opciones de radio.")
                return False
                
            opcion_elegida = None
            lbl_elegido = None
            pref = tipo_forzado

            if not pref:
                from base_datos.conexion import obtener_sesion_bd
                from base_datos.repositorio import RepositorioBaseDatos
                with obtener_sesion_bd() as session:
                    repo = RepositorioBaseDatos(session)
                    pref = repo.obtener_preferencia_documento(criterio)
                    
                    # Si no hay preferencia explícita en BD pero el criterio es numérico de empresa (>6 dígitos), asumir NIT
                    if not pref and len(criterio) >= 8 and criterio.isdigit():
                        pref = "NIT"
                    elif not pref:
                        # El documento no tiene tipo configurado o está pendiente: registrar advertencia
                        repo.marcar_desambiguacion_requerida(criterio)
                        logger.warning(
                            f"El agente identificó que el documento {criterio} requiere definir si corresponde a NIT o Cédula. "
                            f"Se generó la notificación en la plataforma web para su configuración."
                        )
                        return False

            if pref:
                pref_norm = str(pref).lower().strip()
                if pref_norm == "ambos":
                    pref_norm = "nit"

                for r, lbl, label in opciones:
                    label_norm = label.lower()
                    if pref_norm == "nit" and "nit" in label_norm:
                        opcion_elegida = r
                        lbl_elegido = lbl
                        logger.info(f"Usando opción '{label}' (coincide con '{pref}') para {criterio}.")
                        break
                    elif pref_norm in ["cédula", "cedula", "cc"] and any(term in label_norm for term in ["cédula", "cedula", "ciudadanía", "ciudadania", "c.c."]):
                        opcion_elegida = r
                        lbl_elegido = lbl
                        logger.info(f"Usando opción '{label}' (coincide con '{pref}') para {criterio}.")
                        break
                    elif pref_norm in label_norm:
                        opcion_elegida = r
                        lbl_elegido = lbl
                        logger.info(f"Usando opción '{label}' para {criterio}.")
                        break
                            
            if not opcion_elegida:
                logger.warning(f"No se encontró una opción en el modal que coincida con '{pref}' para {criterio}.")
                return False
                    
            # Seleccionar la opción configurada haciendo clic en su label (Bootstrap custom radio)
            if lbl_elegido:
                await lbl_elegido.click(force=True)
            else:
                await opcion_elegida.click(force=True)
            
            await opcion_elegida.evaluate("(el) => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            await page.wait_for_timeout(600)
            
            # Hacer clic en Continuar
            btn_continuar = await modal.query_selector("button:has-text('Continuar'), .btn-primary, button.btn-continuar")
            if btn_continuar:
                await btn_continuar.click(force=True)
                logger.info(f"Opción '{pref}' confirmada exitosamente en SIMIT.")
            else:
                await page.keyboard.press("Enter")
                logger.info("Se presionó Enter para confirmar la opción.")
                
            logger.info("Esperando carga de comparendos tras confirmar tipo de documento...")
            await page.wait_for_timeout(2500)
            return True
        except Exception as e:
            logger.warning(f"Error al manejar modal de desambiguación: {e}")
            return False


# Alias de compatibilidad
SimitBrowserClient = ClienteNavegadorSimit

