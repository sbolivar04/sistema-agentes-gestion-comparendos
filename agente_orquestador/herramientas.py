import re
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, text, func

from configuracion import configuracion
from base_datos.conexion import obtener_sesion_bd, motor
from base_datos.modelos import ComparendoORM, LogExtraccionORM
from base_datos.repositorio import RepositorioBaseDatos

logger = logging.getLogger("HerramientasOrquestador")

def consultar_resumen_flota(criterio_busqueda: str = None, estado: str = "Activo") -> Dict[str, Any]:
    """
    Obtiene el resumen financiero y operativo consolidado de los comparendos de la flota en Supabase.
    Parámetro 'estado':
      - 'Activo' (por defecto): Consulta solo comparendos vigentes / pendientes de pago / activos (deuda real de la empresa).
      - 'No activo': Consulta solo comparendos pagados / descargados del SIMIT / inactivos (ya resueltos).
      - 'Todos' o 'Historico': Consulta todo el historial acumulado (activos + pagados).
    Retorna cantidad de comparendos, monto total nominal, monto optimizado con descuentos,
    ahorro potencial disponible y conteos globales de la flota.
    """
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            resumen = repo.obtener_resumen_flota(criterio_busqueda=criterio_busqueda, estado=estado)
            
            # Obtener desglose por secretaría según el estado consultado
            stmt_secretarias = select(
                ComparendoORM.secretaria, func.count(ComparendoORM.id), func.sum(ComparendoORM.valor_total)
            )
            if estado and str(estado).strip().lower() not in ["todos", "historico", "global", "all"]:
                es_inactivo = any(t in str(estado).lower() for t in ["inactiv", "no activ", "no_activ", "pagad", "descargad"])
                stmt_secretarias = stmt_secretarias.where(ComparendoORM.estado_simit == ('No activo' if es_inactivo else 'Activo'))
            
            stmt_secretarias = stmt_secretarias.group_by(ComparendoORM.secretaria)
            
            secretarias_top = [
                {"secretaria": row[0], "cantidad": row[1], "total": float(row[2])}
                for row in sesion.execute(stmt_secretarias).all()
            ]
            
            resumen["desglose_secretarias"] = secretarias_top
            resumen["exitoso"] = True
            return resumen
    except Exception as e:
        logger.error(f"Error en consultar_resumen_flota: {e}")
        return {"exitoso": False, "error": str(e)}

def consultar_comparendos_vehiculo(placa: str, estado: str = "Activo") -> Dict[str, Any]:
    """
    Consulta los comparendos asociados a una placa vehicular específica.
    Parámetro 'estado':
      - 'Activo' (por defecto): Consulta solo los comparendos vigentes/pendientes de esa placa.
      - 'No activo': Consulta los comparendos pagados/descargados/resueltos de esa placa.
      - 'Todos' o 'Historico': Muestra el historial completo de la placa (activos + pagados).
    Retorna si el carro está al día, deuda activa actual, total de comparendos y la lista con sus detalles.
    """
    placa_limpia = re.sub(r'[^A-Z0-9]', '', placa.upper())
    try:
        with obtener_sesion_bd() as sesion:
            stmt = select(ComparendoORM).where(ComparendoORM.placa == placa_limpia).order_by(ComparendoORM.fecha_infraccion.desc())
            todos_registros = sesion.scalars(stmt).all()

            if not todos_registros:
                return {
                    "exitoso": True,
                    "placa": placa_limpia,
                    "esta_al_dia": True,
                    "total_comparendos": 0,
                    "mensaje": f"No se encontraron comparendos registrados para la placa {placa_limpia}. El carro está al día.",
                    "comparendos": []
                }

            total_historico = len(todos_registros)
            total_activos = sum(1 for c in todos_registros if c.estado_simit == 'Activo')
            total_pagados = sum(1 for c in todos_registros if c.estado_simit == 'No activo')
            deuda_activa = sum(c.valor_total for c in todos_registros if c.estado_simit == 'Activo')

            # Filtrar registros a retornar según parámetro 'estado'
            texto_estado = str(estado).strip().lower() if estado else "activo"
            if texto_estado in ["todos", "historico", "global", "all"]:
                registros_filtrados = todos_registros
            elif any(t in texto_estado for t in ["inactiv", "no activ", "no_activ", "pagad", "descargad", "cancelad", "resuelt"]):
                registros_filtrados = [c for c in todos_registros if c.estado_simit == 'No activo']
            else:
                registros_filtrados = [c for c in todos_registros if c.estado_simit == 'Activo']

            lista_detalles = []
            for c in registros_filtrados:
                lista_detalles.append({
                    "numero_comparendo": c.numero_comparendo,
                    "numero_resolucion": c.numero_resolucion,
                    "tipo_registro": c.tipo_registro,
                    "codigo_infraccion": c.codigo_infraccion,
                    "descripcion": c.descripcion_infraccion,
                    "secretaria": c.secretaria,
                    "fecha_infraccion": c.fecha_infraccion.strftime("%Y-%m-%d %H:%M:%S") if c.fecha_infraccion else None,
                    "fecha_notificacion": c.fecha_notificacion.strftime("%Y-%m-%d") if c.fecha_notificacion else None,
                    "valor_nominal": c.valor,
                    "intereses": c.intereses,
                    "valor_total": c.valor_total,
                    "aplica_descuento_50": c.aplica_descuento_50,
                    "fecha_limite_50": str(c.fecha_limite_descuento_50) if c.fecha_limite_descuento_50 else None,
                    "valor_con_descuento_50": c.valor_con_descuento_50,
                    "aplica_descuento_25": c.aplica_descuento_25,
                    "fecha_limite_25": str(c.fecha_limite_descuento_25) if c.fecha_limite_descuento_25 else None,
                    "valor_con_descuento_25": c.valor_con_descuento_25,
                    "estado_simit": c.estado_simit
                })

            total_nominal_filtrado = sum(c["valor_total"] for c in lista_detalles)
            return {
                "exitoso": True,
                "placa": placa_limpia,
                "esta_al_dia": (total_activos == 0),
                "deuda_activa_actual": deuda_activa,
                "resumen_placa": {
                    "activos_vigentes": total_activos,
                    "pagados_o_descargados": total_pagados,
                    "total_historico": total_historico
                },
                "total_comparendos_retornados": len(lista_detalles),
                "total_deuda_nominal_retornada": total_nominal_filtrado,
                "comparendos": lista_detalles
            }
    except Exception as e:
        logger.error(f"Error en consultar_comparendos_vehiculo ({placa}): {e}")
        return {"exitoso": False, "error": str(e)}

def consultar_comparendos_empresa(nit: str, estado: str = "Activo") -> Dict[str, Any]:
    """
    Consulta los comparendos asociados al NIT de una empresa de la flota corporativa.
    Parámetro 'estado':
      - 'Activo' (por defecto): Consulta solo comparendos vigentes / pendientes de pago.
      - 'No activo': Consulta solo comparendos pagados / descargados del SIMIT.
      - 'Todos': Consulta el historial completo.
    """
    nit_limpio = re.sub(r'[^0-9]', '', str(nit))
    try:
        with obtener_sesion_bd() as sesion:
            stmt = select(ComparendoORM).where(ComparendoORM.criterio_busqueda == nit_limpio).order_by(ComparendoORM.fecha_infraccion.desc())
            todos_registros = sesion.scalars(stmt).all()

            texto_estado = str(estado).strip().lower() if estado else "activo"
            if texto_estado in ["todos", "historico", "global", "all"]:
                registros_filtrados = todos_registros
            elif any(t in texto_estado for t in ["inactiv", "no activ", "no_activ", "pagad", "descargad"]):
                registros_filtrados = [c for c in todos_registros if c.estado_simit == 'No activo']
            else:
                registros_filtrados = [c for c in todos_registros if c.estado_simit == 'Activo']

            lista_detalles = []
            for c in registros_filtrados:
                lista_detalles.append({
                    "numero_comparendo": c.numero_comparendo,
                    "placa": c.placa,
                    "codigo_infraccion": c.codigo_infraccion,
                    "secretaria": c.secretaria,
                    "fecha_infraccion": c.fecha_infraccion.strftime("%Y-%m-%d") if c.fecha_infraccion else None,
                    "valor_total": c.valor_total,
                    "aplica_descuento_50": c.aplica_descuento_50,
                    "aplica_descuento_25": c.aplica_descuento_25,
                    "estado_simit": c.estado_simit
                })

            total_nominal = sum(c["valor_total"] for c in lista_detalles)
            return {
                "exitoso": True,
                "nit": nit_limpio,
                "estado_consultado": estado,
                "total_comparendos": len(lista_detalles),
                "total_valor_nominal": total_nominal,
                "comparendos": lista_detalles
            }
    except Exception as e:
        logger.error(f"Error en consultar_comparendos_empresa ({nit}): {e}")
        return {"exitoso": False, "error": str(e)}

def analizar_riesgo_descuentos(dias_alerta: int = 5) -> Dict[str, Any]:
    """
    Analiza la base de datos para identificar comparendos que tienen descuentos del 50% o 25%
    cuyas fechas límites están próximas a vencer en los próximos N días.
    Permite priorizar pagos estratégicos para no perder los beneficios financieros.
    """
    try:
        with obtener_sesion_bd() as sesion:
            hoy = date.today()
            limite_alerta = hoy + timedelta(days=dias_alerta)

            stmt = select(ComparendoORM).where(
                ComparendoORM.estado_simit == 'Activo'
            ).where(
                (ComparendoORM.aplica_descuento_50 == True) | (ComparendoORM.aplica_descuento_25 == True)
            )
            registros = sesion.scalars(stmt).all()

            en_riesgo = []
            for c in registros:
                fecha_limite = c.fecha_limite_descuento_50 if c.aplica_descuento_50 else c.fecha_limite_descuento_25
                if not fecha_limite:
                    continue  # Aún no notificado, los términos de vencimiento no han empezado a correr

                tipo_desc = "50%" if c.aplica_descuento_50 else "25%"
                ahorro_pesos = (c.valor_total - (c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25))
                
                dias_restantes = (fecha_limite - hoy).days

                en_riesgo.append({
                    "numero_comparendo": c.numero_comparendo,
                    "placa": c.placa,
                    "descuento_vigente": tipo_desc,
                    "fecha_limite": str(fecha_limite),
                    "dias_calendario_restantes": dias_restantes,
                    "valor_nominal": c.valor_total,
                    "valor_a_pagar": c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25,
                    "ahorro_en_juego": ahorro_pesos,
                    "secretaria": c.secretaria
                })

            en_riesgo.sort(key=lambda x: x["dias_calendario_restantes"])

            return {
                "exitoso": True,
                "total_comparendos_con_descuento": len(en_riesgo),
                "total_ahorro_en_juego": sum(x["ahorro_en_juego"] for x in en_riesgo),
                "comparendos_prioritarios": en_riesgo
            }
    except Exception as e:
        logger.error(f"Error en analizar_riesgo_descuentos: {e}")
        return {"exitoso": False, "error": str(e)}

def evaluar_posible_prescripcion() -> Dict[str, Any]:
    """
    Evalúa comparendos con más de 3 años de antigüedad desde la fecha de la infracción
    según el Artículo 159 del Código Nacional de Tránsito (Ley 769/2002).
    Identifica multas potencialmente prescriptibles para solicitar su prescripción y exoneración.
    """
    try:
        with obtener_sesion_bd() as sesion:
            hace_tres_anios = datetime.now() - timedelta(days=3 * 365)
            
            stmt = select(ComparendoORM).where(
                ComparendoORM.estado_simit == 'Activo'
            ).where(
                ComparendoORM.fecha_infraccion <= hace_tres_anios
            )
            registros = sesion.scalars(stmt).all()

            candidatos = []
            for c in registros:
                anios_transcurridos = round((datetime.now() - c.fecha_infraccion).days / 365.25, 1)
                candidatos.append({
                    "numero_comparendo": c.numero_comparendo,
                    "placa": c.placa,
                    "fecha_infraccion": c.fecha_infraccion.strftime("%Y-%m-%d"),
                    "antiguedad_anios": anios_transcurridos,
                    "secretaria": c.secretaria,
                    "valor_total": c.valor_total,
                    "tipo_registro": c.tipo_registro,
                    "sugerencia_legal": "Comparendo con más de 3 años de antigüedad. Si la secretaría no ha notificado mandamiento de pago coactivo, procede derecho de petición de prescripción bajo el Art. 159 Ley 769/2002."
                })

            return {
                "exitoso": True,
                "total_candidatos_prescripcion": len(candidatos),
                "total_monto_potencialmente_prescriptible": sum(c["valor_total"] for c in candidatos),
                "comparendos_antiguos": candidatos
            }
    except Exception as e:
        logger.error(f"Error en evaluar_posible_prescripcion: {e}")
        return {"exitoso": False, "error": str(e)}

def ejecutar_consulta_sql_segura(consulta_sql: str) -> Dict[str, Any]:
    """
    Motor seguro Text-to-SQL de solo lectura (SELECT).
    Ejecuta consultas analíticas personalizadas sobre el esquema comparendos_fscr.
    Bloquea estrictamente cualquier comando destructivo o modificatorio (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE).
    """
    consulta_limpia = consulta_sql.strip().rstrip(";")
    
    # 1. Validar que comience con SELECT o WITH
    if not re.match(r'^(SELECT|WITH)\b', consulta_limpia, re.IGNORECASE):
        return {
            "exitoso": False,
            "error": "Operación denegada por seguridad: Solo se permiten consultas analíticas de lectura (SELECT o WITH)."
        }

    # 2. Bloquear palabras clave peligrosas
    palabras_prohibidas = [
        r'\bINSERT\b', r'\bUPDATE\b', r'\bDELETE\b', r'\bDROP\b', r'\bALTER\b',
        r'\bTRUNCATE\b', r'\bCREATE\b', r'\bGRANT\b', r'\bREVOKE\b', r'\bEXECUTE\b'
    ]
    for palabra in palabras_prohibidas:
        if re.search(palabra, consulta_limpia, re.IGNORECASE):
            return {
                "exitoso": False,
                "error": f"Operación denegada por seguridad: La consulta contiene comandos no permitidos ({palabra})."
            }

    try:
        with obtener_sesion_bd() as sesion:
            resultado = sesion.execute(text(consulta_limpia))
            columnas = list(resultado.keys()) if resultado.returns_rows else []
            filas = resultado.fetchall()

            datos = []
            for fila in filas[:50]:
                fila_dict = {}
                for col, val in zip(columnas, fila):
                    if isinstance(val, (datetime, date)):
                        fila_dict[col] = val.isoformat()
                    elif hasattr(val, '__float__') and not isinstance(val, (int, float, bool)):
                        fila_dict[col] = float(val)
                    else:
                        fila_dict[col] = val
                datos.append(fila_dict)

            return {
                "exitoso": True,
                "columnas": columnas,
                "total_filas": len(filas),
                "filas": datos
            }
    except Exception as e:
        logger.error(f"Error al ejecutar SQL ({consulta_sql}): {e}")
        return {"exitoso": False, "error": f"Error en la consulta SQL: {str(e)}"}

_ultimo_evento_extraccion: Optional[Dict[str, Any]] = None

def registrar_evento_extraccion(datos: Dict[str, Any]):
    global _ultimo_evento_extraccion
    _ultimo_evento_extraccion = datos

def obtener_y_limpiar_evento_extraccion() -> Optional[Dict[str, Any]]:
    global _ultimo_evento_extraccion
    evento = _ultimo_evento_extraccion
    _ultimo_evento_extraccion = None
    return evento

def solicitar_actualizacion_simit(criterio: Optional[str] = None, tipo_consulta: Optional[str] = None) -> Dict[str, Any]:
    """
    Consulta y actualiza en vivo los comparendos oficiales directamente
    desde el portal del SIMIT hacia la base de datos Supabase Cloud.

    Soporta dos modalidades:
    1. ACTUALIZACIÓN MASIVA (Toda la flota / Todos los NITs):
       - Si criterio es None, vacío, o palabras como 'todos', 'flota', 'masivo', 'empresas':
         Inicia la actualización secuencial de todas las empresas y NITs registrados en el sistema.
    2. ACTUALIZACIÓN PUNTUAL (Un vehículo o NIT específico):
       - Si criterio es una Placa (ej. 'WEO146') o un NIT (ej. '900160091'):
         Detecta automáticamente si es placa o NIT y lanza la consulta puntual en vivo.
    """
    import threading
    from plataforma_web.rutas_api.extraccion import disparar_workflow_github
    
    criterio_limpio = str(criterio).strip().upper() if criterio else None
    
    # 1. Detectar si es masiva
    if not criterio_limpio or criterio_limpio in ["TODOS", "FLOTA", "TODAS", "MASIVO", "GLOBAL", "TODO", "EMPRESAS", "NONE"]:
        criterio_final = None
        tipo_final = "NIT"
        es_masivo = True
    else:
        es_masivo = False
        placa_clean = re.sub(r'[^A-Z0-9]', '', criterio_limpio)
        if re.match(r'^[A-Z]{3}\d{2}[A-Z0-9]$', placa_clean):
            criterio_final = placa_clean
            tipo_final = "PLACA"
        elif placa_clean.isdigit():
            criterio_final = placa_clean
            tipo_final = "NIT"
        else:
            criterio_final = placa_clean
            tipo_final = tipo_consulta.upper() if tipo_consulta else "NIT"

    # 2. Verificar si ya hay una consulta ejecutándose actualmente en el SIMIT
    try:
        from plataforma_web.rutas_api.extraccion import consultar_estado_extraccion
        estado_actual = consultar_estado_extraccion()
        if estado_actual.get("en_progreso"):
            registrar_evento_extraccion({
                "iniciada": True,
                "modo": "masivo" if es_masivo else "puntual",
                "criterio": criterio_final,
                "tipo_consulta": tipo_final,
                "tipo_ejecucion": "ya_en_ejecucion"
            })
            return {
                "exitoso": True,
                "ya_en_ejecucion": True,
                "modo": "masivo" if es_masivo else "puntual",
                "mensaje": f"Actualmente ya se está ejecutando una consulta en el SIMIT ({estado_actual.get('mensaje')}). Los datos se están sincronizando en este momento.",
                "tipo_ejecucion": "ya_en_ejecucion"
            }
    except Exception as e_check:
        logger.warning(f"No fue posible verificar estado previo de ejecución: {e_check}")

    # 3. Intentar disparar vía GitHub Actions (en la nube)
    try:
        exito_github = disparar_workflow_github(criterio=criterio_final, tipo_consulta=tipo_final)
        if exito_github:
            registrar_evento_extraccion({
                "iniciada": True,
                "modo": "masivo" if es_masivo else "puntual",
                "criterio": criterio_final,
                "tipo_consulta": tipo_final,
                "tipo_ejecucion": "remoto_github_actions"
            })
            if es_masivo:
                return {
                    "exitoso": True,
                    "modo": "masivo",
                    "mensaje": "Se inició con éxito la consulta y actualización masiva de toda la flota directamente en el portal del SIMIT. En pocos instantes todos los comparendos y estados estarán actualizados en Supabase.",
                    "tipo_ejecucion": "remoto_github_actions"
                }
            else:
                return {
                    "exitoso": True,
                    "modo": "puntual",
                    "criterio": criterio_final,
                    "tipo_consulta": tipo_final,
                    "mensaje": f"Se inició con éxito la consulta en vivo de {tipo_final} {criterio_final} en el SIMIT. La información se está sincronizando en la base de datos.",
                    "tipo_ejecucion": "remoto_github_actions"
                }
    except Exception as e_gh:
        logger.warning(f"No fue posible disparar en GitHub Actions ({e_gh}), ejecutando en entorno local...")

    # 3. Fallback: Ejecución local
    try:
        registrar_evento_extraccion({
            "iniciada": True,
            "modo": "masivo" if es_masivo else "puntual",
            "criterio": criterio_final,
            "tipo_consulta": tipo_final,
            "tipo_ejecucion": "local_background"
        })
        if es_masivo:
            from agente_extraccion_simit.extractor_lote import ejecutar_extraccion_lote
            hilo = threading.Thread(target=ejecutar_extraccion_lote, kwargs={"sin_interfaz": True, "origen": "MANUAL_MASIVO"}, daemon=True)
            hilo.start()
            return {
                "exitoso": True,
                "modo": "masivo",
                "mensaje": "Se inició la consulta y actualización masiva de toda la flota en segundo plano. Supabase se irá actualizando a medida que se procese cada entidad.",
                "tipo_ejecucion": "local_background"
            }
        else:
            from agente_extraccion_simit.extractor_principal import ejecutar_extraccion
            resultado = ejecutar_extraccion(criterio=criterio_final, tipo_consulta=tipo_final, sin_interfaz=True, origen="MANUAL_INDIVIDUAL")
            if resultado and resultado.exitoso:
                return {
                    "exitoso": True,
                    "modo": "puntual",
                    "criterio": criterio_final,
                    "tipo_consulta": tipo_final,
                    "total_comparendos_obtenidos": resultado.total_comparendos,
                    "total_valor_sin_descuento": resultado.total_valor_total,
                    "total_valor_optimizado": resultado.total_valor_con_descuento_vigente,
                    "ahorro_disponible": resultado.total_valor_total - resultado.total_valor_con_descuento_vigente,
                    "tipo_ejecucion": "local_sincrono"
                }
            else:
                return {
                    "exitoso": False,
                    "error": resultado.mensaje_error if resultado else "No se obtuvo respuesta del portal SIMIT."
                }
    except Exception as e_local:
        logger.error(f"Error en fallback local de extracción: {e_local}")
        return {"exitoso": False, "error": str(e_local)}

# Mantener compatibilidad con nombre anterior
solicitar_extraccion_en_vivo = solicitar_actualizacion_simit

def consultar_estado_extraccion_simit() -> Dict[str, Any]:
    """
    Consulta en tiempo real el estado actual de la actualización en el portal SIMIT
    (si está en progreso, si ya concluyó, o el resultado del último barrido).
    """
    from plataforma_web.rutas_api.extraccion import consultar_estado_extraccion
    try:
        return consultar_estado_extraccion()
    except Exception as e:
        logger.error(f"Error en consultar_estado_extraccion_simit: {e}")
        return {"en_progreso": False, "error": str(e)}
