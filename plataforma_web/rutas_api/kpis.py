from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from sqlalchemy import select, func, desc

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
            repo = RepositorioBaseDatos(sesion)
            resumen_bd = repo.obtener_resumen_flota()

            # Conteo de inactivos
            stmt_inactivos = select(func.count(ComparendoORM.id)).where(ComparendoORM.estado_simit == 'No activo')
            total_inactivos = sesion.execute(stmt_inactivos).scalar() or 0

            # Conteo de activos
            stmt_activos = select(func.count(ComparendoORM.id)).where(ComparendoORM.estado_simit == 'Activo')
            total_activos = sesion.execute(stmt_activos).scalar() or 0

            # Última fecha y hora real de sincronización
            stmt_ultimo_log = select(LogExtraccionORM.fecha_ejecucion).order_by(desc(LogExtraccionORM.fecha_ejecucion)).limit(1)
            ultima_fecha = sesion.execute(stmt_ultimo_log).scalar()

            if not ultima_fecha:
                stmt_ultima_act = select(func.max(ComparendoORM.fecha_ultima_actualizacion))
                ultima_fecha = sesion.execute(stmt_ultima_act).scalar()

            fecha_sincronizacion_texto = formatear_fecha_colombia(ultima_fecha) if ultima_fecha else "Pendiente"

            return {
                "exitoso": True,
                "deuda_nominal_total": resumen_bd.get("total_valor_nominal", 0),
                "deuda_optimizada_total": resumen_bd.get("total_valor_con_descuento", 0),
                "ahorro_potencial_total": resumen_bd.get("ahorro_disponible", 0),
                "total_comparendos": resumen_bd.get("total_comparendos", 0),
                "total_activos": total_activos,
                "total_inactivos": total_inactivos,
                "con_descuento_50": resumen_bd.get("con_descuento_50", 0),
                "con_descuento_25": resumen_bd.get("con_descuento_25", 0),
                "sin_descuento": resumen_bd.get("sin_descuento", 0),
                "ultima_sincronizacion": fecha_sincronizacion_texto,
                "ultima_sincronizacion_iso": ultima_fecha.isoformat() if ultima_fecha else None
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener KPIs: {str(e)}")
