from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime, date, timedelta
from sqlalchemy import select

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM, LogExtraccionORM
from agente_extraccion_simit.festivos_colombia import contar_dias_habiles

enrutador_alertas = APIRouter(prefix="/api/alertas", tags=["Alertas"])

@enrutador_alertas.get("")
def obtener_alertas_sistema() -> Dict[str, Any]:
    """
    Retorna el conjunto de alertas inteligentes del sistema:
    1. Comparendos nuevos ingresados en extracciones recientes.
    2. Semáforo de vencimiento de descuentos:
       - Amarillo: 8 a 5 días hábiles restantes.
       - Rojo: 4 días hábiles o menos restantes.
    """
    try:
        hoy = date.today()

        with obtener_sesion_bd() as sesion:
            # 1. Comparendos Activos con Descuento Vigente
            stmt_descuentos = select(ComparendoORM).where(
                ComparendoORM.estado_simit == 'Activo'
            ).where(
                (ComparendoORM.aplica_descuento_50 == True) | (ComparendoORM.aplica_descuento_25 == True)
            )
            comparendos_desc = sesion.scalars(stmt_descuentos).all()

            alertas_vencimiento = []
            for c in comparendos_desc:
                fecha_limite = c.fecha_limite_descuento_50 if c.aplica_descuento_50 else c.fecha_limite_descuento_25
                tipo_desc = "50%" if c.aplica_descuento_50 else "25%"
                ahorro = c.valor_total - (c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25)

                if fecha_limite and fecha_limite >= hoy:
                    dias_habiles_restantes = contar_dias_habiles(hoy, fecha_limite)
                    dias_calendario = (fecha_limite - hoy).days

                    # Clasificación Semáforo:
                    # Rojo: <= 4 días hábiles
                    # Amarillo: 5 a 8 días hábiles
                    # Verde: > 8 días hábiles
                    if dias_habiles_restantes <= 4:
                        nivel = "ROJO"
                        color = "#ef4444"
                        icono = "alert-triangle"
                        mensaje_urgencia = f"¡Urgente! Vence en {dias_habiles_restantes} días hábiles"
                    elif dias_habiles_restantes <= 8:
                        nivel = "AMARILLO"
                        color = "#f59e0b"
                        icono = "clock"
                        mensaje_urgencia = f"Precaución: Vence en {dias_habiles_restantes} días hábiles"
                    else:
                        nivel = "VERDE"
                        color = "#10b981"
                        icono = "shield-check"
                        mensaje_urgencia = f"Vigente: {dias_habiles_restantes} días hábiles"

                    alertas_vencimiento.append({
                        "id": c.id,
                        "placa": c.placa,
                        "numero_comparendo": c.numero_comparendo,
                        "tipo_descuento": tipo_desc,
                        "fecha_limite": str(fecha_limite),
                        "dias_habiles_restantes": dias_habiles_restantes,
                        "dias_calendario_restantes": dias_calendario,
                        "nivel_alerta": nivel,
                        "color": color,
                        "icono": icono,
                        "mensaje_urgencia": mensaje_urgencia,
                        "valor_nominal": c.valor_total,
                        "valor_a_pagar": c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25,
                        "ahorro_en_juego": ahorro,
                        "secretaria": c.secretaria
                    })

            alertas_vencimiento.sort(key=lambda x: x["dias_habiles_restantes"])

            # 2. Comparendos Nuevos Ingresados (Últimos 7 días)
            hace_siete_dias = datetime.now() - timedelta(days=7)
            stmt_nuevos = select(ComparendoORM).where(
                ComparendoORM.fecha_descarga_simit >= hace_siete_dias
            ).order_by(ComparendoORM.fecha_descarga_simit.desc()).limit(10)
            
            comparendos_nuevos = [
                {
                    "id": c.id,
                    "placa": c.placa,
                    "numero_comparendo": c.numero_comparendo,
                    "codigo_infraccion": c.codigo_infraccion,
                    "secretaria": c.secretaria,
                    "fecha_descarga": c.fecha_descarga_simit.strftime("%Y-%m-%d %H:%M") if c.fecha_descarga_simit else None,
                    "valor_total": c.valor_total
                }
                for c in sesion.scalars(stmt_nuevos).all()
            ]

            # 3. Comparendos Pagados / Inactivos (Recientemente Saneados)
            stmt_pagados = select(ComparendoORM).where(
                ComparendoORM.estado_simit == 'No activo'
            ).order_by(ComparendoORM.fecha_ultima_actualizacion.desc()).limit(5)
            
            comparendos_pagados = [
                {
                    "id": c.id,
                    "placa": c.placa,
                    "numero_comparendo": c.numero_comparendo,
                    "codigo_infraccion": c.codigo_infraccion,
                    "secretaria": c.secretaria,
                    "valor_total": c.valor_total
                }
                for c in sesion.scalars(stmt_pagados).all()
            ]

            # 4. Alertas de Configuración de Entidades (Desambiguación NIT / Cédula)
            from base_datos.repositorio import RepositorioBaseDatos
            repo = RepositorioBaseDatos(sesion)
            entidades_db = repo.obtener_entidades_consulta(solo_activas=False)
            alertas_configuracion = [
                {
                    "id": e.id,
                    "nombre_entidad": e.nombre_entidad,
                    "criterio_busqueda": e.criterio_busqueda,
                    "tipo_documento": e.tipo_documento,
                    "mensaje": f"El agente identificó que {e.nombre_entidad} (Doc: {e.criterio_busqueda}) requiere definir si corresponde a NIT o Cédula para consultar sus comparendos en el SIMIT."
                }
                for e in entidades_db
                if e.requiere_desambiguacion or e.tipo_documento in ["Pendiente", "Sin especificar"]
            ]

            return {
                "exitoso": True,
                "total_alertas_vencimiento": len(alertas_vencimiento),
                "total_rojas": sum(1 for a in alertas_vencimiento if a["nivel_alerta"] == "ROJO"),
                "total_amarillas": sum(1 for a in alertas_vencimiento if a["nivel_alerta"] == "AMARILLO"),
                "total_nuevos_recientes": len(comparendos_nuevos),
                "total_pagados_recientes": len(comparendos_pagados),
                "total_alertas_configuracion": len(alertas_configuracion),
                "alertas_vencimiento": alertas_vencimiento,
                "comparendos_nuevos": comparendos_nuevos,
                "comparendos_pagados": comparendos_pagados,
                "alertas_configuracion": alertas_configuracion
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener alertas: {str(e)}")
