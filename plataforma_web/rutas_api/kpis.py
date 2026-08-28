from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from sqlalchemy import select, func

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM
from base_datos.repositorio import RepositorioBaseDatos

enrutador_kpis = APIRouter(prefix="/api/kpis", tags=["KPIs"])

@enrutador_kpis.get("")
def obtener_metricas_kpi() -> Dict[str, Any]:
    """
    Retorna las métricas ejecutivas consolidadas de la flota:
    - Deuda total nominal
    - Deuda optimizada con descuentos
    - Ahorro potencial disponible
    - Conteo total de comparendos
    - Conteo de comparendos activos e inactivos
    - Conteo de comparendos con descuento 50%, 25% y sin descuento
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
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener KPIs: {str(e)}")
