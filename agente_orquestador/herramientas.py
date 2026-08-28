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

def consultar_resumen_flota(criterio_busqueda: str = None) -> Dict[str, Any]:
    """
    Obtiene el resumen financiero y operativo consolidado de todos los comparendos de la flota en Supabase.
    Retorna cantidad total de comparendos, monto total nominal, monto optimizado con descuentos,
    ahorro potencial disponible y cantidad de comparendos con descuento vigente del 50%, 25% y sin descuento.
    """
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            resumen = repo.obtener_resumen_flota(criterio_busqueda=criterio_busqueda)
            
            # Obtener desglose por secretaría
            stmt_secretarias = select(
                ComparendoORM.secretaria, func.count(ComparendoORM.id), func.sum(ComparendoORM.valor_total)
            ).where(ComparendoORM.estado_simit == 'Activo').group_by(ComparendoORM.secretaria)
            
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

def consultar_comparendos_vehiculo(placa: str) -> Dict[str, Any]:
    """
    Consulta el historial detallado de infracciones y comparendos asociados a una placa vehicular específica.
    Retorna la lista de comparendos con sus fechas de infracción, fechas límites de descuento,
    montos, códigos de infracción, secretarías emisoras y resoluciones.
    """
    placa_limpia = re.sub(r'[^A-Z0-9]', '', placa.upper())
    try:
        with obtener_sesion_bd() as sesion:
            stmt = select(ComparendoORM).where(ComparendoORM.placa == placa_limpia).order_by(ComparendoORM.fecha_infraccion.desc())
            registros = sesion.scalars(stmt).all()

            if not registros:
                return {
                    "exitoso": True,
                    "placa": placa_limpia,
                    "total_comparendos": 0,
                    "mensaje": f"No se encontraron comparendos registrados para la placa {placa_limpia}.",
                    "comparendos": []
                }

            lista_detalles = []
            for c in registros:
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

            total_nominal = sum(c["valor_total"] for c in lista_detalles)
            return {
                "exitoso": True,
                "placa": placa_limpia,
                "total_comparendos": len(lista_detalles),
                "total_deuda_nominal": total_nominal,
                "comparendos": lista_detalles
            }
    except Exception as e:
        logger.error(f"Error en consultar_comparendos_vehiculo ({placa}): {e}")
        return {"exitoso": False, "error": str(e)}

def consultar_comparendos_empresa(nit: str) -> Dict[str, Any]:
    """
    Consulta los comparendos y estado de cuenta asociados al NIT de una empresa de la flota corporativa.
    Retorna el resumen de infracciones de todos los vehículos de esa empresa.
    """
    nit_limpio = re.sub(r'[^0-9]', '', str(nit))
    try:
        with obtener_sesion_bd() as sesion:
            stmt = select(ComparendoORM).where(ComparendoORM.criterio_busqueda == nit_limpio).order_by(ComparendoORM.fecha_infraccion.desc())
            registros = sesion.scalars(stmt).all()

            lista_detalles = []
            for c in registros:
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
                tipo_desc = "50%" if c.aplica_descuento_50 else "25%"
                ahorro_pesos = (c.valor_total - (c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25))
                
                dias_restantes = (fecha_limite - hoy).days if fecha_limite else 0

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

            datos = [dict(zip(columnas, fila)) for fila in filas[:50]]
            return {
                "exitoso": True,
                "columnas": columnas,
                "total_filas": len(filas),
                "filas": datos
            }
    except Exception as e:
        logger.error(f"Error al ejecutar SQL ({consulta_sql}): {e}")
        return {"exitoso": False, "error": f"Error en la consulta SQL: {str(e)}"}

def solicitar_extraccion_en_vivo(criterio: str, tipo_consulta: str = "NIT") -> Dict[str, Any]:
    """
    Invoca el Agente Extractor Playwright para consultar en vivo el portal oficial SIMIT
    para un NIT o Placa vehicular, persistiendo y actualizando Supabase en tiempo real.
    """
    from agente_extraccion_simit.extractor_principal import ejecutar_extraccion
    try:
        resultado = ejecutar_extraccion(criterio=criterio, tipo_consulta=tipo_consulta, sin_interfaz=True)
        if resultado and resultado.exitoso:
            return {
                "exitoso": True,
                "criterio": criterio,
                "total_comparendos_obtenidos": resultado.total_comparendos,
                "valor_total": resultado.total_valor_total,
                "valor_con_descuento": resultado.total_valor_con_descuento_vigente,
                "ahorro_disponible": resultado.total_valor_total - resultado.total_valor_con_descuento_vigente
            }
        else:
            return {
                "exitoso": False,
                "error": resultado.mensaje_error if resultado else "No se obtuvo respuesta del extractor."
            }
    except Exception as e:
        logger.error(f"Error en solicitar_extraccion_en_vivo ({criterio}): {e}")
        return {"exitoso": False, "error": str(e)}
