from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from sqlalchemy import select, func, desc, case

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM, LogExtraccionORM
from base_datos.repositorio import RepositorioBaseDatos
from configuracion import formatear_fecha_colombia

enrutador_kpis = APIRouter(prefix="/api/kpis", tags=["KPIs"])

@enrutador_kpis.get("")
def obtener_metricas_kpi() -> Dict[str, Any]:
    """
    Retorna las métricas ejecutivas consolidadas de la flota y la fecha real de última sincronización en horario de Colombia.
    """
    try:
        with obtener_sesion_bd() as sesion:
            # Consulta SQL consolidada: calcula todas las métricas en un único viaje a Supabase
            val_opt = case(
                (ComparendoORM.aplica_descuento_50 == True, ComparendoORM.valor_con_descuento_50),
                (ComparendoORM.aplica_descuento_25 == True, ComparendoORM.valor_con_descuento_25),
                else_=ComparendoORM.valor_total
            )
            ahorro_calc = ComparendoORM.valor_total - val_opt

            stmt_consolidado = select(
                func.count(ComparendoORM.id).label("total_comparendos"),
                func.count(case((ComparendoORM.estado_simit == 'Activo', 1))).label("total_activos"),
                func.count(case((ComparendoORM.estado_simit == 'No activo', 1))).label("total_inactivos"),
                func.count(case(((ComparendoORM.estado_simit == 'Activo') & (ComparendoORM.aplica_descuento_50 == True), 1))).label("con_descuento_50"),
                func.count(case(((ComparendoORM.estado_simit == 'Activo') & (ComparendoORM.aplica_descuento_25 == True), 1))).label("con_descuento_25"),
                func.count(case(((ComparendoORM.aplica_descuento_50 == False) & (ComparendoORM.aplica_descuento_25 == False), 1))).label("sin_descuento"),
                func.coalesce(func.sum(ComparendoORM.valor_total), 0).label("deuda_total"),
                func.coalesce(func.sum(case((ComparendoORM.estado_simit == 'Activo', ComparendoORM.valor_total), else_=0)), 0).label("deuda_activa"),
                func.coalesce(func.sum(val_opt), 0).label("deuda_optimizada_total"),
                func.coalesce(func.sum(ahorro_calc), 0).label("ahorro_potencial_total"),
                func.coalesce(func.sum(case((ComparendoORM.estado_simit == 'Activo', ahorro_calc), else_=0)), 0).label("ahorro_potencial_activo")
            )
            fila = sesion.execute(stmt_consolidado).one()
            m = fila._mapping

            deuda_total = round(float(m["deuda_total"]))
            deuda_activa = round(float(m["deuda_activa"]))
            ahorro_total = round(float(m["ahorro_potencial_total"]))
            ahorro_activo = round(float(m["ahorro_potencial_activo"]))

            # Última fecha y hora real de sincronización (un solo índice ordenado)
            stmt_ultimo_log = select(LogExtraccionORM.fecha_ejecucion).order_by(desc(LogExtraccionORM.fecha_ejecucion)).limit(1)
            ultima_fecha = sesion.execute(stmt_ultimo_log).scalar()

            if not ultima_fecha:
                stmt_ultima_act = select(func.max(ComparendoORM.fecha_ultima_actualizacion))
                ultima_fecha = sesion.execute(stmt_ultima_act).scalar()

            fecha_sincronizacion_texto = formatear_fecha_colombia(ultima_fecha) if ultima_fecha else "Pendiente"

            return {
                "exitoso": True,
                "deuda_nominal_total": deuda_total,
                "deuda_nominal_activa": deuda_activa,
                "deuda_nominal_inactiva": max(0, deuda_total - deuda_activa),
                "deuda_optimizada_total": round(float(m["deuda_optimizada_total"])),
                "ahorro_potencial_total": ahorro_total,
                "ahorro_potencial_activo": ahorro_activo,
                "ahorro_potencial_inactivo": max(0, ahorro_total - ahorro_activo),
                "total_comparendos": m["total_comparendos"],
                "total_activos": m["total_activos"],
                "total_inactivos": m["total_inactivos"],
                "con_descuento_50": m["con_descuento_50"],
                "con_descuento_25": m["con_descuento_25"],
                "sin_descuento": m["sin_descuento"],
                "ultima_sincronizacion": fecha_sincronizacion_texto,
                "ultima_sincronizacion_iso": ultima_fecha.isoformat() if ultima_fecha else None
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener KPIs: {str(e)}")
