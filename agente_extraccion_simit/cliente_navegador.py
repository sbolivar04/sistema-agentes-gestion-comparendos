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

    def _extraer_comparendos_desde_json_api(
        self,
        api_json: dict,
        criterio_clean: str
    ) -> List[ComparendoSchema]:
        """
        Extrae y normaliza los comparendos y multas directamente desde el JSON oficial
        interceptado en memoria de la API de SIMIT (estadocuenta/consulta).
        Garantiza que el número de comparendo y número de resolución vengan separados oficialmente,
        y extrae direcciones, horas, fechas, valores y secretarías en 0.05s sin tocar la UI.
        """
        comparendos_extraidos: List[ComparendoSchema] = []
        if not api_json or not isinstance(api_json, dict):
            return comparendos_extraidos

        listas_api = []
        for categoria in ["multas", "comparendos", "resoluciones"]:
            items = api_json.get(categoria)
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        listas_api.append((categoria, item))

        numeros_procesados = set()

        for categoria, item in listas_api:
            num_comp = str(
                item.get("numeroComparendo") 
                or item.get("numero") 
                or item.get("idComparendo") 
                or ""
            ).strip().upper()

            raw_res = item.get("numeroResolucion") or item.get("resolucion")
            num_res = str(raw_res).strip().upper() if raw_res and str(raw_res).strip().lower() not in ["none", "null", ""] else None

            # Si no viene número de comparendo pero sí de resolución, respaldar identificador
            if not num_comp and num_res:
                num_comp = num_res

            if not num_comp and not num_res:
                continue

            # Evitar duplicados exactos si SIMIT lista el mismo registro en varias secciones
            identificador_unico = (num_comp, num_res or "")
            if identificador_unico in numeros_procesados:
                continue
            numeros_procesados.add(identificador_unico)

            # Clasificación jurídica: Multa vs Comparendo
            # En SIMIT una Multa es solo cuando existe resolución sancionatoria en firme
            tiene_resolucion = bool(num_res or item.get("fechaResolucion") or item.get("idResolucion"))
            estado_sancionado = str(item.get("estadoComparendo", "")).strip().lower() == "sancionado"
            es_cat_resolucion = "resolucion" in str(categoria).lower()

            if (tiene_resolucion or estado_sancionado or es_cat_resolucion) and not item.get("comparendo"):
                tipo_registro_val = "Multa"
            elif tiene_resolucion and estado_sancionado:
                tipo_registro_val = "Multa"
            else:
                tipo_registro_val = "Comparendo"

            # Parseo de fechas oficiales
            fecha_inf_str = str(item.get("fechaComparendo") or item.get("fechaInfraccion") or item.get("fecha") or item.get("fechaHora") or "").strip()
            fecha_inf_val = parse_datetime(fecha_inf_str) or datetime.now()

            fecha_res_str = str(item.get("fechaResolucion") or "").strip()
            fecha_res_val = parse_datetime(fecha_res_str) if (fecha_res_str and "1900" not in fecha_res_str) else None

            # En SIMIT, 01/01/1900 es un valor nulo para comparendos aún no notificados
            fecha_notif_str = str(item.get("fechaNotificacion") or item.get("fechaNotif") or "").strip()
            if not fecha_notif_str or "1900" in fecha_notif_str:
                fecha_notif_val = None
            else:
                fecha_notif_val = parse_datetime(fecha_notif_str)

            # Código y descripción de la infracción extraídos del array oficial 'infracciones'
            infracciones_lista = item.get("infracciones") or []
            primera_inf = infracciones_lista[0] if (isinstance(infracciones_lista, list) and len(infracciones_lista) > 0 and isinstance(infracciones_lista[0], dict)) else {}

            cod_inf_raw = str(
                primera_inf.get("codigoInfraccion") 
                or item.get("codigoInfraccion") 
                or item.get("infraccion") 
                or item.get("codigo") 
                or "COMPARENDO"
            ).strip().upper()

            cod_match = re.search(r'\b[A-Z]\d{2}\b', cod_inf_raw)
            codigo_inf = cod_match.group(0) if cod_match else cod_inf_raw

            desc_inf = str(
                primera_inf.get("descripcionInfraccion") 
                or item.get("descripcionInfraccion") 
                or item.get("descripcion") 
                or f"Infracción {codigo_inf} reportada en SIMIT"
            ).strip()

            # Detección de fotomulta / medio tecnológico
            es_foto = bool(
                item.get("comparendoElectronico")
                or "foto" in desc_inf.lower()
                or "electronico" in desc_inf.lower()
                or "camara" in desc_inf.lower()
                or "foto" in str(item.get("tipoMedio", "")).lower() 
                or bool(item.get("fotodeteccion"))
            )

            # Regla legal: en comparendos físicos sin fecha explícita, se notifica en el acto
            if not es_foto and not fecha_notif_val and fecha_inf_val:
                fecha_notif_val = fecha_inf_val

            # Placa vehicular
            placa_candidata = str(item.get("placa") or item.get("placaVehiculo") or "").strip().upper()
            if placa_candidata:
                placa_val = placa_candidata
            elif len(criterio_clean) <= 6 and not criterio_clean.isdigit():
                placa_val = criterio_clean
            else:
                placa_val = "DESCONOCIDA"

            # Secretaría / Organismo de Tránsito
            sec_raw = str(item.get("organismoTransito") or item.get("secretaria") or item.get("nombreSecretaria") or "Secretaría de Tránsito").strip()
            if sec_raw and "secretaria" not in sec_raw.lower() and "tránsito" not in sec_raw.lower() and "transito" not in sec_raw.lower():
                sec_val = f"Secretaría de {sec_raw}"
            else:
                sec_val = sec_raw or "Secretaría de Tránsito"

            # Dirección de la infracción
            dir_raw = str(item.get("direccion") or item.get("lugarInfraccion") or item.get("lugar") or "").strip()
            if dir_raw and "lunes" not in dir_raw.lower() and "horario" not in dir_raw.lower():
                direccion_val = dir_raw
            else:
                org_raw = str(item.get("organismoTransito") or item.get("secretaria") or "").strip()
                dep_raw = str(item.get("departamento") or "").strip()
                if org_raw and dep_raw:
                    direccion_val = f"Jurisdicción {org_raw} ({dep_raw})"
                elif org_raw:
                    direccion_val = f"Jurisdicción {org_raw}"
                else:
                    direccion_val = None

            # Fuente del comparendo (Detección electrónica, Polca o Agente)
            polca_val = str(item.get("polca", "")).strip().upper()
            fuente_raw = str(item.get("fuente") or item.get("fuenteComparendo") or item.get("origen") or "").strip()
            if fuente_raw:
                fuente_val = fuente_raw
            elif polca_val == "S":
                fuente_val = "POLCA (Policía de Carreteras)"
            elif es_foto:
                fuente_val = "SIMIT Electrónico (Cámara / Fotodetección)"
            else:
                fuente_val = "Agente de Tránsito (Físico en Vía)"

            # Infractor
            infractor_dict = item.get("infractor") if isinstance(item.get("infractor"), dict) else {}
            doc_infractor = str(infractor_dict.get("numeroDocumento") or "").strip() or None
            nombre_infractor = f"{infractor_dict.get('nombre', '')} {infractor_dict.get('apellido', '')}".strip() or None

            # Valores financieros e intereses
            valor_val = parse_currency(str(item.get("valor") or item.get("valorComparendo") or item.get("valorTotal") or 0))
            intereses_val = parse_currency(str(item.get("valorIntereses") or item.get("interes") or item.get("intereses") or 0))

            total_item_raw = item.get("valorPagar") or item.get("total") or item.get("valorTotalPagar")
            if total_item_raw is not None:
                valor_total_calc = parse_currency(str(total_item_raw))
            else:
                valor_total_calc = valor_val + intereses_val

            if valor_total_calc == 0.0 and (valor_val > 0 or intereses_val > 0):
                valor_total_calc = valor_val + intereses_val

            comparendos_extraidos.append(ComparendoSchema(
                numero_comparendo=num_comp,
                numero_resolucion=num_res,
                tipo_registro=tipo_registro_val,
                fecha_infraccion=fecha_inf_val,
                fecha_notificacion=fecha_notif_val,
                fecha_resolucion=fecha_res_val,
                placa=placa_val,
                criterio_busqueda=criterio_clean,
                infractor_documento=doc_infractor,
                infractor_nombre=nombre_infractor,
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

        return comparendos_extraidos

    async def _extraer_comparendos_de_tabla_actual(
        self,
        page,
        criterio_clean: str,
        numero_comparendo_objetivo: Optional[str] = None,
        api_holder: dict = None
    ) -> List[ComparendoSchema]:
        """
        Extrae todos los comparendos y multas visibles en SIMIT para el criterio actual.
        - VÍA PRIORITARIA (Opción B - API First): Si la API oficial de SIMIT (estadocuenta/consulta)
          capturó datos en memoria, extrae instantáneamente en 0.05s con máxima fidelidad sin tocar la UI.
        - VÍA DE CONTINGENCIA (Visual Fila por Fila): Si la API no respondió o si es búsqueda dirigida
          a un comparendo puntual (numero_comparendo_objetivo), ingresa a la vista 'Detalle'.
        """
        comparendos_extraidos: List[ComparendoSchema] = []
        objetivo_limpio = re.sub(r'[^A-Z0-9]', '', str(numero_comparendo_objetivo).upper()) if numero_comparendo_objetivo else None

        # 1. EVALUAR REGISTROS DETECTADOS EN LA TABLA VISUAL
        results_table = await page.query_selector("mat-table, table.table, table, .mat-elevation-z8")
        if results_table:
            raw_rows = await results_table.query_selector_all("tbody tr, mat-row, tr.mat-row")
        else:
            raw_rows = await page.query_selector_all("table tbody tr, mat-table mat-row, tr.mat-row")
        
        # Filtrar únicamente filas reales que contengan celdas de datos (al menos 5 celdas de comparendo o multa)
        rows = []
        for r in raw_rows:
            celdas_r = await r.query_selector_all("td, mat-cell, .mat-cell, div[role='gridcell']")
            if len(celdas_r) >= 5:
                rows.append(r)

        if len(rows) > 0:
            print(f" [SIMIT]: Se detectaron {len(rows)} registros (comparendos/multas) en pantalla. Extrayendo información fila por fila...")

        comp_set = set()

        for idx in range(len(rows)):
            rows_current = []
            for _ in range(12):
                raw_curr = await page.query_selector_all("mat-table mat-row, table tbody tr, tr.mat-row, .mat-row, div[role='row']")
                rows_current = []
                for rc in raw_curr:
                    celdas_rc = await rc.query_selector_all("td, mat-cell, .mat-cell, div[role='gridcell']")
                    if len(celdas_rc) >= 5:
                        rows_current.append(rc)
                if len(rows_current) > idx:
                    break
                await page.wait_for_timeout(350)

            if idx >= len(rows_current):
                break
            row = rows_current[idx]

            tds = await row.query_selector_all("td, mat-cell, .mat-cell, div[role='gridcell']")
            if len(tds) < 5:
                continue

            col0_text = (await tds[0].inner_text()).strip()
            nums_encontrados = re.findall(r'\b[A-Z0-9\-]{6,25}\b', col0_text)
            nums_filtrados = [n for n in nums_encontrados if "6026800" not in n and "413588" not in n]
            if not nums_filtrados:
                continue

            comp_20_digitos = next((n for n in nums_filtrados if len(n) >= 15 and n.isdigit()), None)
            res_candidato = next((n for n in nums_filtrados if n != comp_20_digitos), None)

            # Si es consulta dirigida a un comparendo específico, verificar coincidencia antes de abrir el Detalle
            if objetivo_limpio:
                coincide = False
                for nf in nums_filtrados:
                    if re.sub(r'[^A-Z0-9]', '', nf.upper()) == objetivo_limpio:
                        coincide = True
                        break
                if not coincide and objetivo_limpio in re.sub(r'[^A-Z0-9]', '', col0_text.upper()):
                    coincide = True
                if not coincide:
                    continue

            num_raw = comp_20_digitos or nums_filtrados[0]
            if num_raw in comp_set:
                continue
            comp_set.add(num_raw)

            if comp_20_digitos:
                num_comp = comp_20_digitos
                num_resolucion_val = res_candidato  # Solo si existe una resolución distinta
            else:
                num_comp = num_raw
                num_resolucion_val = None

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

            # Navegación interactiva a la vista 'Detalle':
            # Solo se navega en modo visual interactivo para capturar la dirección exacta de la vía
            debe_navegar_detalle = not self.headless

            if link_elem and debe_navegar_detalle:
                try:
                    print(f"  [{idx+1}/{len(rows)}] Extrayendo comparendo {num_comp} (Placa: {placa_val})...")
                    logger.debug(f"Navegando a la vista detallada del comparendo [{idx+1}/{len(rows)}]...")
                    await link_elem.click()
                    
                    # Espera reactiva ultrarrápida al contenedor del detalle
                    try:
                        await page.wait_for_selector(
                            "app-detalle-comparendo, mat-card, .card, div:has-text('Información comparendo')",
                            state="visible",
                            timeout=1400
                        )
                    except Exception:
                        await page.wait_for_timeout(400)

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
                            logger.info(f"Vista Detalle extraída [{idx+1}/{len(rows)}] -> Res: {num_resolucion_val}, Comparendo: {num_comp}, Fecha: {fecha_str_det}, Hora: {hora_str_det}, Dirección: {direccion_val}")

                        if detalle_data.get("fecha_notificacion"):
                            raw_f_notif = str(detalle_data["fecha_notificacion"]).strip()
                            if "1900" not in raw_f_notif:
                                parsed_f_notif = parse_datetime(raw_f_notif)
                                if parsed_f_notif:
                                    fecha_notif = parsed_f_notif

                    # Cerrar cualquier pestaña emergente no deseada abierta por enlaces con target="_blank"
                    for p in page.context.pages:
                        if p != page:
                            try:
                                await p.close()
                            except Exception:
                                pass

                    # RETORNO A LA TABLA:
                    # 1. Buscar botón de retorno con selectores específicos y seguros
                    selector_volver = (
                        "button:has-text('Volver'), button:has-text('VOLVER'), "
                        "button:has-text('Regresar'), button:has-text('REGRESAR'), "
                        "button:has-text('Atrás'), button:has-text('ATRAS'), "
                        "a:has-text('Volver'), a:has-text('Regresar'), a:has-text('Atrás'), "
                        ".btn-volver, .btn-regresar, "
                        "button:has(mat-icon:has-text('arrow_back')), "
                        "button:has(mat-icon:has-text('arrow_back_ios')), "
                        "button:has(mat-icon:has-text('navigate_before')), "
                        "[aria-label*='volver' i], [aria-label*='regresar' i]"
                    )

                    volver_btn = await page.query_selector(selector_volver)
                    tabla_visible = False
                    if volver_btn and await volver_btn.is_visible():
                        logger.debug(f"Pulsando botón de retorno tras detalle [{idx+1}/{len(rows)}]...")
                        await volver_btn.click(force=True)
                        try:
                            await page.wait_for_selector(
                                "mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row",
                                state="visible",
                                timeout=1200
                            )
                            tabla_visible = True
                        except Exception:
                            await page.wait_for_timeout(350)

                    # 2. Si no retornó con el botón, verificar o ejecutar navegación hacia atrás del historial (go_back)
                    if not tabla_visible:
                        for _ in range(4):
                            tabla_check = await page.query_selector("mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row")
                            if tabla_check and await tabla_check.is_visible():
                                tabla_visible = True
                                break
                            await page.wait_for_timeout(200)

                    if not tabla_visible:
                        logger.info(f"Tabla no visible tras retorno. Ejecutando page.go_back() [{idx+1}/{len(rows)}]...")
                        await page.go_back()
                        try:
                            await page.wait_for_selector(
                                "mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row",
                                state="visible",
                                timeout=1200
                            )
                            tabla_visible = True
                        except Exception:
                            await page.wait_for_timeout(350)
                        for _ in range(8):
                            tabla_check = await page.query_selector("mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row")
                            if tabla_check and await tabla_check.is_visible():
                                tabla_visible = True
                                break
                            await page.wait_for_timeout(300)

                    # 4. Segundo intento de go_back por hash-routing de Angular (#/detalle -> #/resumen)
                    if not tabla_visible:
                        logger.info(f"Reintentando segundo page.go_back() para Angular [{idx+1}/{len(rows)}]...")
                        await page.go_back()
                        await page.wait_for_timeout(1500)
                        for _ in range(8):
                            tabla_check = await page.query_selector("mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row")
                            if tabla_check and await tabla_check.is_visible():
                                tabla_visible = True
                                break
                            await page.wait_for_timeout(300)

                    # 5. AUTO-RECUPERACIÓN: Si sigue sin verse y aún faltan filas, re-consultar en el buscador superior
                    if not tabla_visible and idx + 1 < len(rows):
                        logger.info(f"Restaurando tabla mediante re-búsqueda para {criterio_clean} tras detalle [{idx+1}/{len(rows)}]...")
                        input_box = await page.query_selector("input#txtBusqueda, input[name='txtBusqueda']")
                        if input_box and await input_box.is_visible():
                            await input_box.fill("")
                            await input_box.fill(criterio_clean)
                            await page.dispatch_event("input#txtBusqueda", "input")
                            await page.dispatch_event("input#txtBusqueda", "change")
                            btn_cons = await page.query_selector("button#consultar, button:has-text('Consultar')")
                            if btn_cons and await btn_cons.is_visible():
                                await btn_cons.click(force=True)
                            else:
                                await page.press("input#txtBusqueda", "Enter")
                            
                            for _ in range(20):
                                await page.wait_for_timeout(500)
                                # Gestionar posible modal de desambiguación si vuelve a aparecer
                                modals_mult = await page.query_selector_all("#modal-multiples-personas, #modalMultiplesPersonas, .modal.show:has(input[type='radio'])")
                                for m in modals_mult:
                                    if await m.is_visible():
                                        await self._handle_disambiguation_modal(page, criterio_clean, m, tipo_forzado="NIT" if criterio_clean.isdigit() else "PLACA")
                                        break
                                tabla_rec = await page.query_selector("mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row")
                                if tabla_rec and await tabla_rec.is_visible():
                                    logger.info("¡Tabla de resultados recuperada exitosamente!")
                                    await page.wait_for_timeout(500)
                                    break
                except Exception as ex_detail:
                    logger.warning(f"Aviso al acceder a la vista detallada de {num_resolucion_val}: {ex_detail}")
                    for p in page.context.pages:
                        if p != page:
                            try:
                                await p.close()
                            except Exception:
                                pass

            # Reglas legales:
            # 1. Comparendo físico (en vía con agente): la notificación se realiza en el acto de la infracción
            if not es_foto and not fecha_notif and fecha_val:
                fecha_notif = fecha_val

            # 2. Si cuenta con fecha de resolución o intereses de mora, es jurídicamente una Multa en firme
            if fecha_resolucion_val or intereses_val > 0:
                tipo_registro_val = "Multa"

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

            if objetivo_limpio:
                logger.info(f"Comparendo objetivo {objetivo_limpio} extraído exitosamente de la tabla SIMIT.")
                break

        # Enriquecimiento y rescate universal en memoria con datos de la API interceptada de SIMIT
        if api_holder and api_holder.get("json"):
            try:
                api_json = api_holder["json"]
                listas_api = []
                for k in ["multas", "comparendos", "resoluciones"]:
                    v = api_json.get(k)
                    if isinstance(v, list):
                        listas_api.extend(v)

                # 1. Enriquecer los comparendos extraídos con campos de la API oficial
                for comp in comparendos_extraidos:
                    c_num = str(comp.numero_comparendo or "").strip().upper()
                    c_res = str(comp.numero_resolucion or "").strip().upper()
                    for item in listas_api:
                        if not isinstance(item, dict):
                            continue
                        item_num = str(item.get("numeroComparendo") or item.get("numeroResolucion") or item.get("numero") or item.get("idComparendo") or "").strip().upper()
                        if (c_num and c_num in item_num) or (c_res and c_res in item_num) or (item_num and (item_num in c_num or item_num in c_res)):
                            if not comp.direccion and item.get("direccion"):
                                comp.direccion = str(item.get("direccion")).strip()
                            if not comp.fuente_comparendo and item.get("fuente"):
                                comp.fuente_comparendo = str(item.get("fuente")).strip()
                            
                            # Enriquecer código y descripción oficial de infracción si vino genérica
                            infr_list = item.get("infracciones") or []
                            if infr_list and isinstance(infr_list, list) and len(infr_list) > 0 and isinstance(infr_list[0], dict):
                                inf_obj = infr_list[0]
                                if inf_obj.get("codigoInfraccion") and (comp.codigo_infraccion == "COMPARENDO" or not comp.codigo_infraccion):
                                    comp.codigo_infraccion = str(inf_obj.get("codigoInfraccion")).strip().upper()
                                if inf_obj.get("descripcionInfraccion") and (not comp.descripcion_infraccion or "COMPARENDO" in comp.descripcion_infraccion):
                                    comp.descripcion_infraccion = str(inf_obj.get("descripcionInfraccion")).strip()

                            raw_notif_api = str(item.get("fechaNotificacion") or "").strip()
                            if not comp.fecha_notificacion and raw_notif_api and "1900" not in raw_notif_api:
                                parsed_notif = parse_datetime(raw_notif_api)
                                if parsed_notif:
                                    comp.fecha_notificacion = parsed_notif
                            break

                # 2. RED DE SEGURIDAD: Si la tabla visual tenía N filas pero por fallos de Angular
                # se extrajeron menos comparendos que filas detectadas, completar faltantes
                if len(comparendos_extraidos) < len(rows) and not objetivo_limpio:
                    nums_existentes = {str(c.numero_comparendo).strip().upper() for c in comparendos_extraidos if c.numero_comparendo}
                    nums_existentes.update({str(c.numero_resolucion).strip().upper() for c in comparendos_extraidos if c.numero_resolucion})

                    for item in listas_api:
                        if not isinstance(item, dict):
                            continue
                        num_api = str(item.get("numeroComparendo") or item.get("numeroResolucion") or item.get("numero") or item.get("idComparendo") or "").strip().upper()
                        if not num_api or num_api in nums_existentes:
                            continue

                        raw_res_api = item.get("numeroResolucion")
                        res_api = str(raw_res_api).strip().upper() if raw_res_api else None
                        tipo_reg = "Multa" if ("multa" in str(item.get("tipo", "")).lower() or item.get("fechaResolucion")) else "Comparendo"
                        f_inf = parse_datetime(str(item.get("fechaComparendo") or item.get("fechaInfraccion") or item.get("fecha") or "")) or datetime.now()
                        
                        raw_notif_seg = str(item.get("fechaNotificacion") or "").strip()
                        f_not = parse_datetime(raw_notif_seg) if (raw_notif_seg and "1900" not in raw_notif_seg) else None
                        
                        f_res = parse_datetime(str(item.get("fechaResolucion") or ""))
                        val = parse_currency(str(item.get("valor") or 0))
                        inter = parse_currency(str(item.get("valorIntereses") or item.get("interes") or item.get("intereses") or 0))
                        placa_item = str(item.get("placa") or criterio_clean).strip().upper()
                        sec_item = str(item.get("organismoTransito") or item.get("secretaria") or "Secretaría de Tránsito").strip()
                        
                        # Infracción oficial
                        infr_seg = item.get("infracciones") or []
                        primer_inf_seg = infr_seg[0] if (isinstance(infr_seg, list) and len(infr_seg) > 0 and isinstance(infr_seg[0], dict)) else {}
                        cod_inf = str(primer_inf_seg.get("codigoInfraccion") or item.get("infraccion") or item.get("codigoInfraccion") or "COMPARENDO").strip().upper()
                        desc_inf = str(primer_inf_seg.get("descripcionInfraccion") or item.get("descripcionInfraccion") or item.get("descripcion") or f"Infracción {cod_inf} reportada en SIMIT").strip()
                        
                        dir_item = str(item.get("direccion") or "").strip() or None
                        fuente_item = str(item.get("fuente") or "").strip() or None
                        es_fotomulta = bool(item.get("comparendoElectronico") or "foto" in desc_inf.lower())

                        nuevo_comp = ComparendoSchema(
                            numero_comparendo=num_api,
                            numero_resolucion=res_api,
                            tipo_registro=tipo_reg,
                            fecha_infraccion=f_inf,
                            fecha_notificacion=f_not or (f_inf if not es_fotomulta else None),
                            fecha_resolucion=f_res,
                            placa=placa_item,
                            criterio_busqueda=criterio_clean,
                            codigo_infraccion=cod_inf,
                            descripcion_infraccion=desc_inf,
                            secretaria=sec_item,
                            direccion=dir_item,
                            fuente_comparendo=fuente_item,
                            valor=val,
                            intereses=inter,
                            valor_total=val + inter,
                            es_fotodeteccion=es_fotomulta
                        )
                        comparendos_extraidos.append(nuevo_comp)
                        nums_existentes.add(num_api)
                        if res_api:
                            nums_existentes.add(res_api)

                    logger.info(f"Total comparendos consolidados tras rescate de API SIMIT: {len(comparendos_extraidos)}/{len(rows)}.")
            except Exception as e_api_enrich:
                logger.warning(f"Aviso enriqueciendo comparendos con API interceptada: {e_api_enrich}")

        logger.info(f"Se extrajeron {len(comparendos_extraidos)} comparendos/multas reales en la tabla SIMIT para {criterio_clean}.")
        return comparendos_extraidos

    async def _ejecutar_busqueda_en_pagina(
        self,
        page,
        criterio_clean: str,
        tipo_preferencia: Optional[str] = None,
        api_holder: dict = None,
        max_intentos: int = 3,
        numero_comparendo_objetivo: Optional[str] = None
    ) -> Tuple[bool, List[ComparendoSchema], bool, Optional[str]]:
        """
        Ejecuta un intento de búsqueda en la página actual para un criterio,
        manejando posibles modales de desambiguación con tipo_preferencia.
        Retorna (exitoso, comparendos, modal_detectado, mensaje_error).
        """
        input_selector = "input#txtBusqueda, input[name='txtBusqueda'], input[placeholder*='documento'], input[placeholder*='Placa']"
        busqueda_exitosa = False
        modal_detectado = False
        cant_filas_detectadas = 0

        for intento in range(1, max_intentos + 1):
            logger.info(f"[Intento {intento}/{max_intentos}] Ingresando criterio '{criterio_clean}' (Preferencia: {tipo_preferencia or 'Auto'}) en el buscador SIMIT...")
            
            # 1. Cerrar cualquier pestaña emergente secundaria huérfana
            for p in page.context.pages:
                if p != page:
                    try:
                        await p.close()
                    except Exception:
                        pass

            # 2. Verificar disponibilidad inmediata del buscador
            input_elem = None
            try:
                input_elem = await page.wait_for_selector(input_selector, state="visible", timeout=4000)
            except Exception:
                logger.warning(f"[Intento {intento}] El input de búsqueda no estuvo visible de inmediato. Recuperando portal SIMIT...")
                btn_volver = await page.query_selector("button:has-text('Volver'), .btn-volver, a:has-text('Volver')")
                if btn_volver and await btn_volver.is_visible():
                    try:
                        await btn_volver.click(force=True)
                        await page.wait_for_timeout(1500)
                    except Exception:
                        pass

                # Si sigue sin estar el input, forzar recarga limpia a la URL base de SIMIT
                input_check = await page.query_selector(input_selector)
                if not input_check or not await input_check.is_visible():
                    try:
                        await self._cerrar_anuncios_iniciales(page)
                        await page.goto(self.simit_url, wait_until="domcontentloaded", timeout=25000)
                        await self._cerrar_anuncios_iniciales(page)
                    except Exception as e_goto:
                        logger.warning(f"Aviso al restaurar portal: {e_goto}")

                try:
                    input_elem = await page.wait_for_selector(input_selector, state="visible", timeout=12000)
                except Exception as e_inp:
                    logger.error(f"[Intento {intento}] No se pudo acceder al buscador tras recuperación: {e_inp}")
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
                logger.debug(f"[Intento {intento}] Clic en 'Consultar' para {criterio_clean}.")
            else:
                await page.press(input_selector, "Enter")
                logger.debug(f"[Intento {intento}] Consulta enviada con Enter para {criterio_clean}.")

            # Esperar a que el validador de seguridad interno de SIMIT (whcModal) finalice
            for _ in range(16):
                whc = await page.query_selector("#whcModal")
                if whc and await whc.is_visible():
                    await page.wait_for_timeout(500)
                else:
                    break

            render_ok = False
            es_vacio = False
            for seg in range(1, 26):
                await page.wait_for_timeout(600)
                
                # ¿Apareció el modal de múltiples resultados (Nit/Cédula)?
                modals_multiples = await page.query_selector_all("#modal-multiples-personas, #modalMultiplesPersonas, .modal.show:has(input[type='radio'])")
                hubo_modal_este_seg = False
                for m in modals_multiples:
                    if await m.is_visible():
                        modal_detectado = True
                        hubo_modal_este_seg = True
                        print(f" [SIMIT]: Confirmando tipo de documento ({tipo_preferencia or 'NIT'})...")
                        resuelto = await self._handle_disambiguation_modal(page, criterio_clean, m, tipo_forzado=tipo_preferencia)
                        if not resuelto:
                            return False, [], True, "Requiere configurar si es NIT o Cédula en la plataforma web"
                        await page.wait_for_timeout(600)
                        break
                            
                if hubo_modal_este_seg:
                    continue

                # ¿Aparecieron filas de comparendos o multas en la tabla? (Celdas reales de datos >= 5)
                rows_candidates = await page.query_selector_all("mat-table mat-row, table tbody tr, tr.mat-row, div[role='row'].mat-row")
                filas_reales_conteo = 0
                for rc in rows_candidates:
                    celdas_rc = await rc.query_selector_all("td, mat-cell, .mat-cell, div[role='gridcell']")
                    if len(celdas_rc) >= 5:
                        filas_reales_conteo += 1

                if filas_reales_conteo > 0:
                    cant_filas_detectadas = filas_reales_conteo
                    render_ok = True
                    busqueda_exitosa = True
                    logger.debug(f"[Intento {intento}] Tabla de registros detectada ({cant_filas_detectadas} comparendos/multas encontrados).")
                    break

                # ¿SIMIT desplegó un mensaje oficial de paz y salvo o sin comparendos?
                result_container = await page.query_selector("app-comparendos, #mainView, .main-layout-content, .alert, .estado-cuenta, .empty-state, body")
                if result_container:
                    res_text = (await result_container.inner_text()).lower()
                    if any(msg in res_text for msg in ["no posee a la fecha pendientes", "no tiene comparendos", "no tienes comparendos", "sin comparendos", "no se encontraron comparendos", "no registra comparendos"]):
                        render_ok = True
                        busqueda_exitosa = True
                        es_vacio = True
                        logger.debug(f"[Intento {intento}] SIMIT confirma oficialmente: No existen comparendos registrados para {criterio_clean}.")
                        break
                        
                # Verificación con API interna rápida a partir del ciclo 3 (~1.8s) solo si NO requiere desambiguación de personas
                if seg >= 3 and api_holder and api_holder.get("json") is not None:
                    api_json = api_holder["json"]
                    personas = api_json.get("personasMismoDocumento", [])
                    multas = api_json.get("multas", [])
                    comps = api_json.get("comparendos", [])
                    resols = api_json.get("resoluciones", [])
                    if len(personas) == 0 and len(multas) == 0 and len(comps) == 0 and len(resols) == 0:
                        render_ok = True
                        busqueda_exitosa = True
                        es_vacio = True
                        logger.debug(f"[Intento {intento}] API SIMIT confirma internamente: 0 multas/comparendos para {criterio_clean}.")
                        break

            if render_ok:
                break
            else:
                logger.warning(f"[Intento {intento}] Tiempo de espera agotado sin respuesta clara de SIMIT para {criterio_clean}. Reintentando...")
                if intento < max_intentos:
                    try:
                        logger.info(f"[Intento {intento}] Limpiando estado de SIMIT y recargando página antes del intento {intento + 1}...")
                        await self._cerrar_anuncios_iniciales(page)
                        await page.goto(self.simit_url, wait_until="domcontentloaded", timeout=25000)
                        await self._cerrar_anuncios_iniciales(page)
                        await page.wait_for_timeout(1000)
                    except Exception as e_reload:
                        logger.warning(f"[Intento {intento}] No se pudo recargar la página limpia: {e_reload}")

        if not busqueda_exitosa:
            return False, [], modal_detectado, f"SIMIT no respondió correctamente tras {max_intentos} intentos para {criterio_clean}."

        if es_vacio:
            return True, [], modal_detectado, None

        comparendos = await self._extraer_comparendos_de_tabla_actual(
            page,
            criterio_clean,
            numero_comparendo_objetivo=numero_comparendo_objetivo,
            api_holder=api_holder
        )

        # Validación estricta de integridad de la extracción:
        # Si la tabla visual renderizó N filas y se extrajeron menos de N, la extracción fue incompleta.
        # En tal caso se reporta como no exitosa para bloquear categóricamente la conciliación errónea.
        if not numero_comparendo_objetivo and cant_filas_detectadas > 0 and len(comparendos) < cant_filas_detectadas:
            msg_incompleto = (
                f"Extracción incompleta en SIMIT para {criterio_clean}: Se detectaron {cant_filas_detectadas} registros "
                f"en la tabla pero solo se extrajeron {len(comparendos)}. Se deshabilita conciliación por protección de datos."
            )
            logger.error(f"[PROTECCIÓN DE INTEGRIDAD] {msg_incompleto}")
            return False, comparendos, modal_detectado, msg_incompleto

        return True, comparendos, modal_detectado, None

    async def _consultar_criterio_en_pagina(
        self,
        page,
        criterio: str,
        tipo_consulta: str,
        api_holder: dict = None,
        numero_comparendo_objetivo: Optional[str] = None
    ) -> ResultadoConsultaSchema:
        """
        Ejecuta la consulta de un NIT, Cédula o Placa en una página ya abierta de SIMIT.
        - Si es un NIT corporativo, realiza la búsqueda dual automática:
          1) Variante sin dígito de verificación (ej: 900160091).
          2) Variante con dígito de verificación continuo (ej: 9001600910).
          Consolida y desduplica los comparendos obtenidos de ambas pasadas.
        - Si la entidad está configurada como 'AMBOS' (o se solicita 'AMBOS'), desambigua
          adicionalmente entre NIT y Cédula si SIMIT detecta ambas identidades.
        """
        from agente_extraccion_simit.utilidades_documento import obtener_variantes_busqueda, descomponer_nit

        criterio_raw = str(criterio).strip()
        criterio_clean = re.sub(r'[^A-Z0-9]', '', criterio_raw.upper())
        tipo_solicitado = str(tipo_consulta).strip().upper()

        # Determinar si es placa, cédula o NIT
        es_placa = (tipo_solicitado == "PLACA") or (len(criterio_clean) <= 6 and not criterio_clean.isdigit())
        es_cedula = tipo_solicitado in ("CÉDULA", "CEDULA", "CC")
        es_nit = not es_placa and not es_cedula

        if es_nit:
            nit_base, dv_calc = descomponer_nit(criterio_raw)
            criterio_canonico = nit_base
        else:
            criterio_canonico = criterio_clean

        logger.info(f"Iniciando consulta SIMIT ({tipo_consulta}: '{criterio_raw}' -> Canónico: '{criterio_canonico}')...")

        # Consultar si en base de datos la entidad está configurada como AMBOS
        pref_bd = None
        try:
            from base_datos.conexion import obtener_sesion_bd
            from base_datos.repositorio import RepositorioBaseDatos
            with obtener_sesion_bd() as sesion:
                repo = RepositorioBaseDatos(sesion)
                pref_bd = repo.obtener_preferencia_documento(criterio_canonico)
        except Exception:
            pass

        es_ambos = (tipo_solicitado == "AMBOS") or (pref_bd and pref_bd.strip().upper() == "AMBOS")

        # Generar las variantes a consultar en SIMIT
        if es_nit:
            variantes = obtener_variantes_busqueda(criterio_raw, "NIT")
        elif es_placa:
            variantes = [{"criterio": criterio_clean, "tipo_variante": "PLACA", "descripcion": f"Placa vehicular {criterio_clean}"}]
        else:
            variantes = [{"criterio": criterio_clean, "tipo_variante": "CEDULA", "descripcion": f"Cédula {criterio_clean}"}]

        todos_los_comparendos: List[ComparendoSchema] = []
        variantes_exitosas = []
        variantes_fallidas = []
        ultimo_error = None
        alerta_desambiguacion_requerida = False

        for idx_var, var_info in enumerate(variantes, 1):
            var_criterio = var_info["criterio"]
            var_desc = var_info.get("descripcion", var_criterio)
            
            if len(variantes) > 1:
                logger.info(f"\n[Variante {idx_var}/{len(variantes)}] Consultando en SIMIT: {var_desc}...")

            if es_ambos:
                logger.info(f"Modo AMBOS activo para {var_criterio}: Se consultarán comparendos bajo NIT y Cédula.")
                exito_nit, comps_nit, modal_visto, err_nit = await self._ejecutar_busqueda_en_pagina(
                    page, var_criterio, tipo_preferencia="NIT", api_holder=api_holder, numero_comparendo_objetivo=numero_comparendo_objetivo
                )
                if not exito_nit and err_nit and "Requiere configurar" in err_nit:
                    alerta_desambiguacion_requerida = True
                    ultimo_error = err_nit
                    variantes_fallidas.append({"criterio": var_criterio, "error": err_nit})
                    continue

                if exito_nit:
                    variantes_exitosas.append(f"{var_criterio} (NIT)")
                    todos_los_comparendos.extend(comps_nit)
                else:
                    variantes_fallidas.append({"criterio": f"{var_criterio} (NIT)", "error": err_nit})
                    ultimo_error = err_nit

                # Si el modal de múltiples personas apareció en SIMIT, verificar ambas identidades (NIT y Cédula)
                if modal_visto:
                    logger.info(f"Modal de múltiples identidades detectado para {var_criterio}. Ejecutando pasada secundaria como Cédula...")
                    await page.wait_for_timeout(800)
                    exito_cc, comps_cc, _, err_cc = await self._ejecutar_busqueda_en_pagina(
                        page, var_criterio, tipo_preferencia="Cédula", api_holder=api_holder, numero_comparendo_objetivo=numero_comparendo_objetivo
                    )
                    if exito_cc:
                        variantes_exitosas.append(f"{var_criterio} (Cédula)")
                        if comps_cc:
                            todos_los_comparendos.extend(comps_cc)
                    else:
                        variantes_fallidas.append({"criterio": f"{var_criterio} (Cédula)", "error": err_cc})
                        ultimo_error = err_cc
            else:
                tipo_pref = tipo_consulta if tipo_consulta in ["NIT", "Cédula"] else ("NIT" if es_nit else pref_bd)
                exito, comps_var, _, err_var = await self._ejecutar_busqueda_en_pagina(
                    page, var_criterio, tipo_preferencia=tipo_pref, api_holder=api_holder, numero_comparendo_objetivo=numero_comparendo_objetivo
                )
                if exito:
                    variantes_exitosas.append(var_criterio)
                    todos_los_comparendos.extend(comps_var)
                    logger.info(f"Variante {var_criterio}: {len(comps_var)} registros encontrados.")
                else:
                    variantes_fallidas.append({"criterio": var_criterio, "error": err_var})
                    if err_var and "Requiere configurar" in err_var:
                        alerta_desambiguacion_requerida = True
                    ultimo_error = err_var
                    logger.warning(f"Variante {var_criterio} finalizó con aviso: {err_var}")

            if idx_var < len(variantes):
                await page.wait_for_timeout(1200)

        # Definir tipo de consulta para el resultado
        if es_ambos:
            tipo_enum = TipoConsulta.AMBOS
        elif es_nit:
            tipo_enum = TipoConsulta.NIT
        elif es_cedula:
            tipo_enum = TipoConsulta.CEDULA
        else:
            tipo_enum = TipoConsulta.PLACA

        hubo_al_menos_un_exito = len(variantes_exitosas) > 0
        hubo_fallo_parcial = len(variantes_fallidas) > 0
        extraccion_completa = (not hubo_fallo_parcial) and hubo_al_menos_un_exito

        if not hubo_al_menos_un_exito and alerta_desambiguacion_requerida:
            return ResultadoConsultaSchema(
                criterio_busqueda=criterio_canonico,
                tipo_consulta=tipo_enum,
                exitoso=True,
                total_comparendos=0,
                total_valor_total=0.0,
                total_valor_con_descuento_vigente=0.0,
                comparendos=[],
                mensaje_error=ultimo_error or "Requiere configurar si es NIT o Cédula en la plataforma web",
                permitir_conciliacion=False,
                extraccion_completa=False
            )

        if not hubo_al_menos_un_exito:
            return ResultadoConsultaSchema(
                criterio_busqueda=criterio_canonico,
                tipo_consulta=tipo_enum,
                exitoso=False,
                total_comparendos=0,
                total_valor_total=0.0,
                total_valor_con_descuento_vigente=0.0,
                comparendos=[],
                mensaje_error=ultimo_error or "No se pudo obtener respuesta del portal SIMIT",
                permitir_conciliacion=False,
                extraccion_completa=False
            )

        # Desduplicación inteligente de comparendos
        comparendos_unicos = []
        claves_vistas = set()
        for comp in todos_los_comparendos:
            comp.criterio_busqueda = criterio_canonico
            clave = comp.numero_comparendo or comp.numero_resolucion
            if clave:
                if clave not in claves_vistas:
                    claves_vistas.add(clave)
                    comparendos_unicos.append(comp)
            else:
                comparendos_unicos.append(comp)

        # Cálculo de descuentos según normativa colombiana vigente
        comparendos_enriquecidos = [calculate_discounts(c) for c in comparendos_unicos]
        total_nominal = sum(c.valor_total for c in comparendos_enriquecidos)
        total_con_descuento = sum(
            c.valor_con_descuento_50 if c.aplica_descuento_50 
            else (c.valor_con_descuento_25 if c.aplica_descuento_25 else c.valor_total)
            for c in comparendos_enriquecidos
        )

        # Si hubo fallo parcial en alguna variante obligatoria
        if hubo_fallo_parcial:
            detalles_fallas = "; ".join(f"{v['criterio']}: {v.get('error', 'sin respuesta')}" for v in variantes_fallidas)
            
            # Si no se encontraron comparendos pero alguna variante falló, es un falso vacío
            if len(comparendos_enriquecidos) == 0:
                msg_error_parcial = (
                    f"Consulta incompleta en SIMIT: La variante falló ({detalles_fallas}). "
                    f"Se cancela la conciliación para prevenir falsos paz y salvo."
                )
                logger.error(f"[PROTECCIÓN DE INTEGRIDAD] {criterio_canonico}: {msg_error_parcial}")
                return ResultadoConsultaSchema(
                    criterio_busqueda=criterio_canonico,
                    tipo_consulta=tipo_enum,
                    exitoso=False,
                    total_comparendos=0,
                    total_valor_total=0.0,
                    total_valor_con_descuento_vigente=0.0,
                    comparendos=[],
                    mensaje_error=msg_error_parcial,
                    permitir_conciliacion=False,
                    extraccion_completa=False
                )
            else:
                # Si se encontraron comparendos en una variante pero otra falló, guardar los encontrados sin conciliar los existentes
                # Se marca exitoso=False para que quede constancia del fallo parcial y se pueda reintentar
                msg_aviso_parcial = (
                    f"Extracción parcial: Se encontraron {len(comparendos_enriquecidos)} comparendos pero alguna variante obligatoria falló ({detalles_fallas}). "
                    f"Conciliación omitida por protección."
                )
                logger.warning(f"[PROTECCIÓN DE INTEGRIDAD] {criterio_canonico}: {msg_aviso_parcial}")
                return ResultadoConsultaSchema(
                    criterio_busqueda=criterio_canonico,
                    tipo_consulta=tipo_enum,
                    exitoso=False,
                    total_comparendos=len(comparendos_enriquecidos),
                    total_valor_total=total_nominal,
                    total_valor_con_descuento_vigente=total_con_descuento,
                    comparendos=comparendos_enriquecidos,
                    mensaje_error=msg_aviso_parcial,
                    permitir_conciliacion=False,
                    extraccion_completa=False
                )

        if len(variantes) > 1:
            logger.info(
                f"Consolidación dual finalizada para {criterio_canonico}: "
                f"{len(comparendos_enriquecidos)} comparendos únicos consolidados "
                f"(Total: ${total_nominal:,.2f} COP)."
            )

        if numero_comparendo_objetivo:
            if len(comparendos_enriquecidos) == 0:
                logger.info(
                    f"Comparendo objetivo '{numero_comparendo_objetivo}' no encontrado en SIMIT para {criterio_canonico}. "
                    f"Se confirma que no registra deudas activas (Paz y Salvo / Descargado)."
                )
            else:
                logger.info(
                    f"Comparendo objetivo '{numero_comparendo_objetivo}' extraído exitosamente para {criterio_canonico}."
                )
            return ResultadoConsultaSchema(
                criterio_busqueda=criterio_canonico,
                tipo_consulta=tipo_enum,
                exitoso=True,
                total_comparendos=len(comparendos_enriquecidos),
                total_valor_total=total_nominal,
                total_valor_con_descuento_vigente=total_con_descuento,
                comparendos=comparendos_enriquecidos,
                mensaje_error=None,
                permitir_conciliacion=False,
                extraccion_completa=True
            )

        return ResultadoConsultaSchema(
            criterio_busqueda=criterio_canonico,
            tipo_consulta=tipo_enum,
            exitoso=True,
            total_comparendos=len(comparendos_enriquecidos),
            total_valor_total=total_nominal,
            total_valor_con_descuento_vigente=total_con_descuento,
            comparendos=comparendos_enriquecidos,
            mensaje_error=None,
            permitir_conciliacion=True,
            extraccion_completa=True
        )


    async def consultar_en_vivo_async(
        self,
        criterio: str,
        tipo_consulta: str,
        numero_comparendo_objetivo: Optional[str] = None
    ) -> ResultadoConsultaSchema:
        """Consulta individual o puntual: abre el navegador, consulta el criterio y cierra el navegador."""
        resultados = await self.consultar_lote_en_vivo_async([{
            "criterio": criterio,
            "tipo_documento": tipo_consulta,
            "numero_comparendo_objetivo": numero_comparendo_objetivo
        }])
        return resultados[0] if resultados else ResultadoConsultaSchema(
            criterio_busqueda=criterio,
            tipo_consulta=TipoConsulta.AMBOS if tipo_consulta == "AMBOS" else (TipoConsulta.NIT if (tipo_consulta == "NIT" or criterio.isdigit()) else TipoConsulta.PLACA),
            exitoso=False,
            total_comparendos=0,
            total_valor_total=0.0,
            total_valor_con_descuento_vigente=0.0,
            comparendos=[],
            mensaje_error="No se pudo iniciar la sesión de consulta en vivo",
            permitir_conciliacion=False,
            extraccion_completa=False
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
                            data = await response.json()
                            if isinstance(data, dict):
                                c_len = len(data.get("comparendos", [])) if isinstance(data.get("comparendos"), list) else 0
                                m_len = len(data.get("multas", [])) if isinstance(data.get("multas"), list) else 0
                                r_len = len(data.get("resoluciones", [])) if isinstance(data.get("resoluciones"), list) else 0
                                logger.debug(f"API SIMIT interceptada: Comparendos={c_len}, Multas={m_len}, Resoluciones={r_len}")
                                if c_len > 0 or m_len > 0 or r_len > 0 or not api_holder["json"]:
                                    api_holder["json"] = data
                        except Exception:
                            pass

                page.on("response", handle_response)

                # 1. Cargar portal oficial de SIMIT UNA SOLA VEZ
                logger.debug("Cargando portal SIMIT para sesión masiva...")
                await page.goto(self.simit_url, wait_until="domcontentloaded", timeout=45000)
                await self._cerrar_anuncios_iniciales(page)

                # 2. Consultar secuencialmente cada entidad en la misma pestaña
                input_selector = "input#txtBusqueda, input[name='txtBusqueda'], input[placeholder*='documento'], input[placeholder*='Placa']"
                for idx, item in enumerate(lista_consultas, 1):
                    criterio = str(item.get("criterio") or item.get("nit") or item.get("placa") or "")
                    tipo_doc = str(item.get("tipo_documento") or item.get("tipo_consulta") or ("NIT" if criterio.isdigit() else "PLACA"))
                    empresa = item.get("empresa") or item.get("nombre_entidad") or criterio
                    comp_objetivo = item.get("numero_comparendo_objetivo") or item.get("numero_comparendo")

                    # Cerrar cualquier pestaña emergente adicional antes de iniciar la entidad
                    for p in context.pages:
                        if p != page:
                            try:
                                await p.close()
                            except Exception:
                                pass

                    # Verificación preventiva: Si el buscador no está visible o la URL no es SIMIT, restablecer portal
                    try:
                        input_check = await page.query_selector(input_selector)
                        if not input_check or not await input_check.is_visible() or "/simit/" not in page.url:
                            logger.info(f"Restableciendo página oficial de SIMIT antes de consultar {empresa} ({criterio})...")
                            await page.goto(self.simit_url, wait_until="domcontentloaded", timeout=30000)
                            await self._cerrar_anuncios_iniciales(page)
                    except Exception as e_prev:
                        logger.warning(f"Aviso al verificar estado del portal antes de {criterio}: {e_prev}")

                    logger.info(f"\n[{idx}/{len(lista_consultas)}] Consultando {empresa} ({tipo_doc}: {criterio}) en la misma sesión continua...")
                    resultado = await self._consultar_criterio_en_pagina(
                        page, criterio, tipo_doc, api_holder, numero_comparendo_objetivo=comp_objetivo
                    )
                    resultados.append(resultado)

                    if callback_procesamiento:
                        try:
                            callback_procesamiento(item, resultado)
                        except Exception as e_cb:
                            logger.error(f"Error en callback de procesamiento para {criterio}: {e_cb}")

                return resultados
            finally:
                logger.info("Sesión de extracción masiva completada. Cerrando navegador Chromium...")
                try:
                    if 'context' in locals() and context:
                        await context.close()
                except Exception:
                    pass
                try:
                    if 'browser' in locals() and browser:
                        await browser.close()
                except Exception:
                    pass
                await asyncio.sleep(0.1)

    def consultar_en_vivo(
        self,
        criterio: str,
        tipo_consulta: str,
        numero_comparendo_objetivo: Optional[str] = None
    ) -> ResultadoConsultaSchema:
        """Wrapper síncrono para ejecutar la extracción individual o puntual con Playwright."""
        return asyncio.run(
            self.consultar_en_vivo_async(
                criterio,
                tipo_consulta,
                numero_comparendo_objetivo=numero_comparendo_objetivo
            )
        )

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

