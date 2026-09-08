from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime, date, timedelta, timezone
from sqlalchemy import select, desc

from configuracion import formatear_fecha_colombia, obtener_ahora_colombia, ZONA_HORARIA_COLOMBIA
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
        # Ventana inteligente para capturar novedades recientes (cubre fines de semana: 4 días en lunes/martes, 3 días resto de semana)
        dias_ventana = 4 if hoy.weekday() in (0, 1) else 3
        ventana_novedades = datetime.now() - timedelta(days=dias_ventana)

        with obtener_sesion_bd() as sesion:
            # 1. Comparendos Nuevos Ingresados (Detectados en la ventana reciente) - EXCLUSIVAMENTE ACTIVOS
            stmt_nuevos = select(ComparendoORM).where(
                ComparendoORM.fecha_creacion_registro >= ventana_novedades,
                ComparendoORM.estado_simit == 'Activo'
            ).order_by(ComparendoORM.fecha_creacion_registro.desc()).limit(15)

            comparendos_nuevos_orm = sesion.scalars(stmt_nuevos).all()
            ids_nuevos = {c.id for c in comparendos_nuevos_orm}

            comparendos_nuevos = [
                {
                    "id": c.id,
                    "placa": c.placa,
                    "numero_comparendo": c.numero_comparendo,
                    "codigo_infraccion": c.codigo_infraccion,
                    "secretaria": c.secretaria,
                    "fecha_descarga": c.fecha_creacion_registro.strftime("%Y-%m-%d %H:%M") if c.fecha_creacion_registro else None,
                    "valor_total": round(float(c.valor_total)) if c.valor_total else 0,
                    "tipo_descuento": "50%" if c.aplica_descuento_50 else ("25%" if c.aplica_descuento_25 else None),
                    "valor_con_descuento": round(float(c.valor_con_descuento_50 if c.aplica_descuento_50 else (c.valor_con_descuento_25 if c.aplica_descuento_25 else c.valor_total))) if (c.aplica_descuento_50 or c.aplica_descuento_25) else None,
                    "fecha_limite_descuento": str(c.fecha_limite_descuento_50 if c.aplica_descuento_50 else c.fecha_limite_descuento_25) if ((c.aplica_descuento_50 and c.fecha_limite_descuento_50) or (c.aplica_descuento_25 and c.fecha_limite_descuento_25)) else None
                }
                for c in comparendos_nuevos_orm
            ]

            # 2. Comparendos Activos con Descuento Vigente (Semáforo de vencimiento)
            # Solo aplica a comparendos que NO sean nuevos recién ingresados, para no alertar de vencimiento
            # en vez de alertar la aparición del nuevo comparendo en el SIMIT.
            stmt_descuentos = select(ComparendoORM).where(
                ComparendoORM.estado_simit == 'Activo'
            ).where(
                (ComparendoORM.aplica_descuento_50 == True) | (ComparendoORM.aplica_descuento_25 == True)
            )
            comparendos_desc = sesion.scalars(stmt_descuentos).all()

            alertas_vencimiento = []
            for c in comparendos_desc:
                # Si el comparendo es NUEVO (está reportado en comparendos_nuevos), se prioriza su notificación como nuevo
                if c.id in ids_nuevos:
                    continue

                fecha_limite = c.fecha_limite_descuento_50 if c.aplica_descuento_50 else c.fecha_limite_descuento_25
                tipo_desc = "50%" if c.aplica_descuento_50 else "25%"
                ahorro = c.valor_total - (c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25)

                if fecha_limite and fecha_limite >= hoy:
                    dias_habiles_restantes = contar_dias_habiles(hoy, fecha_limite)
                    dias_calendario = (fecha_limite - hoy).days

                    # Clasificación Semáforo de Riesgo Unificado:
                    # - Crítico (ROJO): <= 4 días hábiles (vencimiento inminente)
                    # - Preventivo (AMARILLO): 5 a 8 días hábiles (en riesgo operativo de perder el beneficio)
                    # - Vigente (VERDE): > 8 días hábiles (plazo holgado)
                    if tipo_desc == "50%":
                        if dias_habiles_restantes <= 4:
                            nivel = "ROJO"
                            color = "#ef4444"
                            icono = "alert-triangle"
                            mensaje_urgencia = f"¡En riesgo 50%! Vence en {dias_habiles_restantes} días hábiles"
                        elif dias_habiles_restantes <= 8:
                            nivel = "AMARILLO"
                            color = "#f59e0b"
                            icono = "clock"
                            mensaje_urgencia = f"En riesgo 50%: Vence en {dias_habiles_restantes} días hábiles"
                        else:
                            nivel = "VERDE"
                            color = "#10b981"
                            icono = "shield-check"
                            mensaje_urgencia = f"Vigente 50%: {dias_habiles_restantes} días hábiles"
                    else:
                        if dias_habiles_restantes <= 4:
                            nivel = "ROJO"
                            color = "#ef4444"
                            icono = "alert-triangle"
                            mensaje_urgencia = f"¡Urgente 25%! Vence en {dias_habiles_restantes} días hábiles"
                        elif dias_habiles_restantes <= 8:
                            nivel = "AMARILLO"
                            color = "#f59e0b"
                            icono = "clock"
                            mensaje_urgencia = f"En riesgo 25%: Vence en {dias_habiles_restantes} días hábiles"
                        else:
                            nivel = "VERDE"
                            color = "#10b981"
                            icono = "shield-check"
                            mensaje_urgencia = f"Vigente 25%: {dias_habiles_restantes} días hábiles"

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
                        "valor_nominal": round(float(c.valor_total)) if c.valor_total else 0,
                        "valor_a_pagar": round(float(c.valor_con_descuento_50 if c.aplica_descuento_50 else c.valor_con_descuento_25)),
                        "ahorro_en_juego": round(float(ahorro)) if ahorro else 0,
                        "secretaria": c.secretaria
                    })

            alertas_vencimiento.sort(key=lambda x: x["dias_habiles_restantes"])

            # 3. Comparendos Pagados / Inactivos (Retirados del SIMIT en la ventana reciente)
            stmt_pagados = select(ComparendoORM).where(
                ComparendoORM.estado_simit == 'No activo',
                ComparendoORM.fecha_descarga_simit >= ventana_novedades
            ).order_by(ComparendoORM.fecha_descarga_simit.desc()).limit(10)
            
            comparendos_pagados = [
                {
                    "id": c.id,
                    "placa": c.placa,
                    "numero_comparendo": c.numero_comparendo,
                    "codigo_infraccion": c.codigo_infraccion,
                    "secretaria": c.secretaria,
                    "valor_total": round(float(c.valor_total)) if c.valor_total else 0,
                    "fecha_actualizacion": c.fecha_descarga_simit.strftime("%Y-%m-%d") if c.fecha_descarga_simit else (c.fecha_ultima_actualizacion.strftime("%Y-%m-%d") if c.fecha_ultima_actualizacion else None)
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

            # 5. Notificaciones de Sincronización SIMIT: Masivas vs Individuales (Exclusivamente del día de hoy)
            ahora_colombia = obtener_ahora_colombia()
            hoy_colombia = ahora_colombia.date()

            stmt_logs = select(LogExtraccionORM).order_by(desc(LogExtraccionORM.fecha_ejecucion)).limit(35)
            logs_recientes = sesion.scalars(stmt_logs).all()

            # Solo conservar logs cuya ejecución haya ocurrido en la fecha de hoy (Colombia)
            def es_del_dia_de_hoy(dt: datetime) -> bool:
                if not dt:
                    return False
                if dt.tzinfo is None:
                    dt_utc = dt.replace(tzinfo=timezone.utc)
                else:
                    dt_utc = dt.astimezone(timezone.utc)
                return dt_utc.astimezone(ZONA_HORARIA_COLOMBIA).date() == hoy_colombia

            logs_hoy = [l for l in logs_recientes if es_del_dia_de_hoy(l.fecha_ejecucion)]
            
            # Mapa con el registro de log más reciente para cada criterio de búsqueda hoy
            ultimo_log_por_criterio = {}
            for l in logs_hoy:
                if l.criterio_busqueda not in ultimo_log_por_criterio:
                    ultimo_log_por_criterio[l.criterio_busqueda] = l

            entidades_dict = {e.criterio_busqueda: e.nombre_entidad for e in entidades_db}
            notificaciones_sincronizacion = []

            # Agrupar logs de hoy:
            # 1. Determinista por 'id_lote' (agrupa exactamente todas las entidades de una misma corrida masiva)
            # 2. Respaldo por proximidad temporal para lotes masivos legados que no tengan id_lote
            # 3. Consultas individuales (MANUAL_INDIVIDUAL): cada una se procesa como consulta individual aislada
            grupos_map = {}
            logs_masivos_sin_lote = []
            grupos_logs = []

            for l in logs_hoy:
                id_lote = getattr(l, "id_lote", None)
                origen_l = getattr(l, "origen", None)
                if id_lote:
                    if id_lote not in grupos_map:
                        grupos_map[id_lote] = []
                    grupos_map[id_lote].append(l)
                elif origen_l in ["PROGRAMADO_MASIVO", "MANUAL_MASIVO"]:
                    logs_masivos_sin_lote.append(l)
                else:
                    # Consulta individual atómica (sin lote)
                    grupos_logs.append([l])

            for g_lote in grupos_map.values():
                grupos_logs.append(g_lote)

            if logs_masivos_sin_lote:
                grupo_actual = []
                for l in logs_masivos_sin_lote:
                    if not grupo_actual:
                        grupo_actual.append(l)
                    else:
                        diff_seg = abs((grupo_actual[-1].fecha_ejecucion - l.fecha_ejecucion).total_seconds())
                        if diff_seg <= 600:
                            grupo_actual.append(l)
                        else:
                            grupos_logs.append(grupo_actual)
                            grupo_actual = [l]
                if grupo_actual:
                    grupos_logs.append(grupo_actual)

            # Ordenar grupos por la fecha más reciente de sus logs (descendente)
            grupos_logs.sort(key=lambda g: max(item.fecha_ejecucion for item in g), reverse=True)

            flota_masiva_incluida = False

            for g in grupos_logs[:10]:
                origen_grupo = getattr(g[0], "origen", None)
                es_corrida_masiva = len(g) >= 2 or origen_grupo in ["PROGRAMADO_MASIVO", "MANUAL_MASIVO"]
                
                if es_corrida_masiva and len(g) >= 2:
                    # Consolidar en una única tarjeta la sincronización masiva más reciente de la flota
                    if flota_masiva_incluida:
                        continue
                    flota_masiva_incluida = True

                    # --- CONSULTA MASIVA (2 o más NITs o vehículos en una misma consulta) ---
                    total_entidades = len(g)
                    items_fallidos_orig = [item for item in g if not item.exitoso]
                    
                    # Un item fallido se considera resuelto si existe un log más reciente hoy con exitoso == True
                    items_fallidos_pendientes = [
                        item for item in items_fallidos_orig
                        if not ultimo_log_por_criterio.get(item.criterio_busqueda, item).exitoso
                    ]
                    
                    fallidos = len(items_fallidos_pendientes)
                    total_exitosos = total_entidades - fallidos
                    # Usar la fecha REAL de ejecución del lote
                    fecha_reciente = max(item.fecha_ejecucion for item in g)
                    fecha_formateada = formatear_fecha_colombia(fecha_reciente)
                    id_identificador = getattr(g[0], "id_lote", None) or f"lote-{g[0].id}"

                    if fallidos == 0:
                        mensaje_exito = (
                            f"Extracción completada sin novedades. Se consultaron las {total_entidades} entidades activas correctamente."
                            if len(items_fallidos_orig) == 0
                            else f"Extracción completada. Las {total_entidades} entidades de la flota quedaron al día tras reintento exitoso."
                        )
                        notificaciones_sincronizacion.append({
                            "id": f"sync-{id_identificador}",
                            "tipo_notificacion": "sync_ok",
                            "nivel_alerta": "VERDE",
                            "titulo": "Sincronización SIMIT exitosa",
                            "empresa": "Flota Corporativa FSCR",
                            "criterio": f"{total_entidades}/{total_entidades} entidades al día",
                            "tipo_consulta": "LOTE",
                            "mensaje": mensaje_exito,
                            "fecha": fecha_formateada,
                            "es_error": False
                        })
                    elif fallidos == 1:
                        fallido = items_fallidos_pendientes[0]
                        criterio_fallido = fallido.criterio_busqueda
                        tipo_fallido = fallido.tipo_consulta.value if hasattr(fallido.tipo_consulta, "value") else (fallido.tipo_consulta or "NIT")
                        nombre_fallido = entidades_dict.get(criterio_fallido) or f"{tipo_fallido} {criterio_fallido}"
                        
                        notificaciones_sincronizacion.append({
                            "id": f"sync-err-{id_identificador}",
                            "tipo_notificacion": "sync_error",
                            "nivel_alerta": "ROJO",
                            "titulo": f"Fallo al consultar {nombre_fallido}",
                            "empresa": nombre_fallido,
                            "criterio": criterio_fallido,
                            "tipo_consulta": tipo_fallido,
                            "mensaje": f"SIMIT no respondió para {nombre_fallido}. Las otras {total_entidades - 1} entidades se consultaron con éxito.",
                            "fecha": fecha_formateada,
                            "es_error": True,
                            "criterio_reintento": criterio_fallido
                        })
                    else:
                        criterios_fallidos = [item.criterio_busqueda for item in items_fallidos_pendientes]
                        nombres_fallidos = [entidades_dict.get(c, c) for c in criterios_fallidos]
                        primer_fallido = items_fallidos_pendientes[0]
                        tipo_fallido = primer_fallido.tipo_consulta.value if hasattr(primer_fallido.tipo_consulta, "value") else (primer_fallido.tipo_consulta or "NIT")
                        
                        notificaciones_sincronizacion.append({
                            "id": f"sync-err-{id_identificador}",
                            "tipo_notificacion": "sync_error",
                            "nivel_alerta": "ROJO",
                            "titulo": f"Fallo en {fallidos} entidades de la flota",
                            "empresa": "Flota Corporativa FSCR",
                            "criterio": criterios_fallidos[0],
                            "tipo_consulta": tipo_fallido,
                            "mensaje": f"Fallaron en SIMIT: {', '.join(nombres_fallidos)}. Reintente la consulta.",
                            "fecha": fecha_formateada,
                            "es_error": True,
                            "criterio_reintento": criterios_fallidos[0]
                        })
                else:
                    # --- CONSULTA INDIVIDUAL (1 solo vehículo o empresa / NIT) ---
                    item = g[0]
                    # Si este fallo individual ya fue superado por un reintento exitoso posterior hoy, no mostrar error
                    if not item.exitoso and ultimo_log_por_criterio.get(item.criterio_busqueda, item).exitoso:
                        continue

                    nombre_entidad = entidades_dict.get(item.criterio_busqueda)
                    tipo_doc = item.tipo_consulta.value if hasattr(item.tipo_consulta, "value") else (item.tipo_consulta or "NIT")

                    if not nombre_entidad:
                        if tipo_doc == "PLACA":
                            nombre_entidad = f"Vehículo {item.criterio_busqueda}"
                        else:
                            nombre_entidad = f"NIT {item.criterio_busqueda}"

                    fecha_formateada = formatear_fecha_colombia(item.fecha_ejecucion)

                    if item.exitoso:
                        notificaciones_sincronizacion.append({
                            "id": f"sync-ind-{item.id}",
                            "tipo_notificacion": "sync_ok",
                            "nivel_alerta": "VERDE",
                            "titulo": f"Sincronización SIMIT: {nombre_entidad}",
                            "empresa": nombre_entidad,
                            "criterio": item.criterio_busqueda,
                            "tipo_consulta": tipo_doc,
                            "mensaje": f"Consulta completada sin novedades. Se consultó {nombre_entidad} correctamente.",
                            "fecha": fecha_formateada,
                            "es_error": False
                        })
                    else:
                        notificaciones_sincronizacion.append({
                            "id": f"sync-ind-err-{item.id}",
                            "tipo_notificacion": "sync_error",
                            "nivel_alerta": "ROJO",
                            "titulo": f"Fallo en consulta SIMIT: {nombre_entidad}",
                            "empresa": nombre_entidad,
                            "criterio": item.criterio_busqueda,
                            "tipo_consulta": tipo_doc,
                            "mensaje": f"El portal SIMIT no respondió para {nombre_entidad} ({tipo_doc} {item.criterio_busqueda}).",
                            "fecha": fecha_formateada,
                            "es_error": True,
                            "criterio_reintento": item.criterio_busqueda
                        })

            return {
                "exitoso": True,
                "total_alertas_vencimiento": len(alertas_vencimiento),
                "total_rojas": sum(1 for a in alertas_vencimiento if a["nivel_alerta"] == "ROJO"),
                "total_amarillas": sum(1 for a in alertas_vencimiento if a["nivel_alerta"] == "AMARILLO"),
                "total_en_riesgo_50": sum(1 for a in alertas_vencimiento if a["tipo_descuento"] == "50%" and a["dias_habiles_restantes"] <= 8),
                "total_en_riesgo_25": sum(1 for a in alertas_vencimiento if a["tipo_descuento"] == "25%" and a["dias_habiles_restantes"] <= 8),
                "total_nuevos_recientes": len(comparendos_nuevos),
                "total_pagados_recientes": len(comparendos_pagados),
                "total_alertas_configuracion": len(alertas_configuracion),
                "total_alertas_sincronizacion": len(notificaciones_sincronizacion),
                "alertas_vencimiento": alertas_vencimiento,
                "comparendos_nuevos": comparendos_nuevos,
                "comparendos_pagados": comparendos_pagados,
                "alertas_configuracion": alertas_configuracion,
                "notificaciones_sincronizacion": notificaciones_sincronizacion
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener alertas: {str(e)}")
