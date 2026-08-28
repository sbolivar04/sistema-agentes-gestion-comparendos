from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy import select, func, text

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM

enrutador_estadisticas = APIRouter(prefix="/api/estadisticas", tags=["Estadísticas"])

@enrutador_estadisticas.get("")
def obtener_estadisticas_temporales() -> Dict[str, Any]:
    """
    Retorna series temporales agrupadas para visualización gráfica:
    - Por mes (últimos 12 meses)
    - Por semana (últimas 8 semanas)
    - Por día (últimos 30 días)
    - Por Secretaría de tránsito
    """
    try:
        with obtener_sesion_bd() as sesion:
            # 1. Agrupación por Mes
            stmt_mes = select(
                func.to_char(ComparendoORM.fecha_infraccion, 'YYYY-MM').label('mes'),
                func.count(ComparendoORM.id).label('cantidad'),
                func.sum(ComparendoORM.valor_total).label('monto')
            ).where(ComparendoORM.fecha_infraccion.is_not(None))\
             .group_by('mes')\
             .order_by('mes')
            
            datos_mes = [
                {"periodo": r[0], "cantidad": r[1], "monto": float(r[2] or 0)}
                for r in sesion.execute(stmt_mes).all()
            ]

            # 2. Agrupación por Día (últimos días registrados)
            stmt_dia = select(
                func.to_char(ComparendoORM.fecha_infraccion, 'YYYY-MM-DD').label('dia'),
                func.count(ComparendoORM.id).label('cantidad'),
                func.sum(ComparendoORM.valor_total).label('monto')
            ).where(ComparendoORM.fecha_infraccion.is_not(None))\
             .group_by('dia')\
             .order_by('dia')
            
            datos_dia = [
                {"periodo": r[0], "cantidad": r[1], "monto": float(r[2] or 0)}
                for r in sesion.execute(stmt_dia).all()
            ]

            # 3. Agrupación por Secretaría
            stmt_secretarias = select(
                ComparendoORM.secretaria,
                func.count(ComparendoORM.id).label('cantidad'),
                func.sum(ComparendoORM.valor_total).label('monto')
            ).group_by(ComparendoORM.secretaria)\
             .order_by(func.count(ComparendoORM.id).desc())
            
            datos_secretarias = [
                {"secretaria": r[0] or "No especificada", "cantidad": r[1], "monto": float(r[2] or 0)}
                for r in sesion.execute(stmt_secretarias).all()
            ]

            return {
                "exitoso": True,
                "por_mes": datos_mes,
                "por_dia": datos_dia,
                "por_secretaria": datos_secretarias
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")
