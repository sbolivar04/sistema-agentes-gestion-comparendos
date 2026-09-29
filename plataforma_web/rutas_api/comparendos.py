import logging
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.orm import joinedload

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM
from plataforma_web.utilidades_exportacion import generar_excel_resumen

logger = logging.getLogger(__name__)

enrutador_comparendos = APIRouter(prefix="/api/comparendos", tags=["Comparendos"])

def serializar_comparendo(c: ComparendoORM) -> Dict[str, Any]:
    """
    Serializa un registro ORM de comparendo con todos los campos canónicos requeridos
    por la plataforma web (tabla, modales emergentes y notificaciones).
    Aplica prevalencia del valor pagado real registrado en la gestión operativa (Paso 2).
    """
    tipo_str = str(c.tipo_registro or "").strip().lower()
    tiene_resolucion = bool(c.fecha_resolucion)
    tiene_intereses = bool(c.intereses and float(c.intereses) > 0)
    es_multa = (tipo_str == "multa") or tiene_resolucion or tiene_intereses
    es_foto = bool(c.es_fotodeteccion)

    es_pagado = (c.estado_simit == "No activo") or (c.estado_simit == "Pagado")

    # 1. Determinar etiqueta y límites teóricos de descuento
    if es_multa:
        tag_desc = "Sin Descuento"
        fecha_lim = "Paz y Salvo" if es_pagado else "Vencido"
        val_teorico = c.valor_total
    elif c.aplica_descuento_50:
        if es_pagado:
            tag_desc = "50% Descuento"
            fecha_lim = "Paz y Salvo"
        elif c.fecha_limite_descuento_50:
            tag_desc = "50% Vigente"
            fecha_lim = str(c.fecha_limite_descuento_50)
        else:
            tag_desc = "50% (Sin Notificar)" if es_foto else "50% Vigente"
            fecha_lim = "Pendiente Notificación" if es_foto else "Vencido"
        val_teorico = c.valor_con_descuento_50
    elif c.aplica_descuento_25:
        if es_pagado:
            tag_desc = "25% Descuento"
            fecha_lim = "Paz y Salvo"
        elif c.fecha_limite_descuento_25:
            tag_desc = "25% Vigente"
            fecha_lim = str(c.fecha_limite_descuento_25)
        else:
            tag_desc = "25% Vigente"
            fecha_lim = "Vencido"
        val_teorico = c.valor_con_descuento_25
    else:
        tag_desc = "Sin Descuento"
        fecha_lim = "Paz y Salvo" if es_pagado else "Vencido"
        val_teorico = c.valor_total

    # 2. Prevalencia: verificar si existe valor pagado real en la gestión operativa
    g = getattr(c, "gestion_operativa", None)
    if isinstance(g, list):
        g = g[0] if g else None

    val_pagado_real = None
    if g and g.valor_pagado is not None and float(g.valor_pagado) > 0:
        val_pagado_real = float(g.valor_pagado)

    valor_total_simit = round(float(c.valor_total)) if c.valor_total else 0

    if val_pagado_real is not None:
        val_pagar = val_pagado_real
        es_valor_real = True
        # Alternativa 2: Si el valor pagado real supera el valor total nominal de SIMIT,
        # el total se ajusta al valor real pagado para reflejar el monto total efectivo con recargo/mora,
        # asegurando que el total nunca sea inferior a lo pagado.
        if val_pagado_real > valor_total_simit:
            valor_total_final = round(val_pagado_real)
            tiene_recargo = True
            recargo_mora = round(val_pagado_real - valor_total_simit)
            ahorro_disp = 0.0
        else:
            valor_total_final = valor_total_simit
            tiene_recargo = False
            recargo_mora = 0
            ahorro_disp = max(0.0, float(valor_total_simit - val_pagado_real))
    else:
        val_pagar = val_teorico
        es_valor_real = False
        valor_total_final = valor_total_simit
        tiene_recargo = False
        recargo_mora = 0
        ahorro_disp = max(0.0, float(valor_total_simit - (val_teorico or 0))) if (val_teorico and valor_total_simit and not es_multa) else 0.0

    # Determinación legal de fecha de notificación para visualización
    if c.fecha_notificacion:
        fecha_notif_str = c.fecha_notificacion.strftime("%Y-%m-%d")
    elif not es_foto and c.fecha_infraccion:
        # Comparendo físico entregado en vía en la fecha de la infracción
        fecha_notif_str = c.fecha_infraccion.strftime("%Y-%m-%d")
    elif es_multa and c.fecha_infraccion:
        # Multas con resolución firme ya fueron notificadas legalmente
        fecha_notif_str = c.fecha_infraccion.strftime("%Y-%m-%d")
    else:
        fecha_notif_str = "En proceso de notificación"

    tipo_registro_final = "Multa" if es_multa else (c.tipo_registro or "Comparendo")

    return {
        "id": c.id,
        "numero_comparendo": c.numero_comparendo,
        "numero_resolucion": c.numero_resolucion,
        "placa": c.placa,
        "criterio_busqueda": c.criterio_busqueda,
        "tipo_registro": tipo_registro_final,
        "codigo_infraccion": c.codigo_infraccion,
        "descripcion_infraccion": c.descripcion_infraccion,
        "secretaria": c.secretaria,
        "direccion": c.direccion,
        "fuente_comparendo": getattr(c, "fuente_comparendo", "SIMIT"),
        "es_fotodeteccion": es_foto,
        "fecha_infraccion": c.fecha_infraccion.strftime("%Y-%m-%d %H:%M") if c.fecha_infraccion else "N/A",
        "fecha_notificacion": fecha_notif_str,
        "fecha_resolucion": c.fecha_resolucion.strftime("%Y-%m-%d") if c.fecha_resolucion else None,
        "valor_nominal": round(float(c.valor)) if c.valor else 0,
        "intereses": round(float(c.intereses)) if c.intereses else 0,
        "valor_total": valor_total_final,
        "valor_total_simit": valor_total_simit,
        "tiene_recargo_pago": tiene_recargo,
        "recargo_mora": recargo_mora,
        "etiqueta_descuento": tag_desc,
        "fecha_limite_descuento": fecha_lim,
        "valor_a_pagar": round(float(val_pagar)) if val_pagar else 0,
        "ahorro_disponible": round(float(ahorro_disp)),
        "es_valor_real_pagado": es_valor_real,
        "valor_pagado_gestion": round(float(val_pagado_real)) if val_pagado_real else None,
        "estado_simit": c.estado_simit
    }


def construir_consulta_filtrada(
    busqueda: Optional[str] = None,
    estado_simit: Optional[str] = "todos",
    filtro_descuento: Optional[str] = "todos"
):
    """
    Construye la consulta SQLAlchemy con todos los filtros aplicados.
    Reutilizada por la paginación y por los exportes a Excel.
    """
    consulta = select(ComparendoORM)

    # 1. Filtro de búsqueda (admite término único o múltiples placas separadas por coma)
    if isinstance(busqueda, str) and busqueda.strip():
        partes = [p.strip() for p in busqueda.split(",") if p.strip()]
        if len(partes) > 1:
            condiciones = [ComparendoORM.placa.ilike(f"%{p}%") for p in partes]
            consulta = consulta.where(or_(*condiciones))
        else:
            termino = f"%{busqueda.strip()}%"
            consulta = consulta.where(
                or_(
                    ComparendoORM.placa.ilike(termino),
                    ComparendoORM.criterio_busqueda.ilike(termino),
                    ComparendoORM.numero_comparendo.ilike(termino),
                    ComparendoORM.codigo_infraccion.ilike(termino),
                    ComparendoORM.secretaria.ilike(termino),
                    ComparendoORM.descripcion_infraccion.ilike(termino)
                )
            )

    # 2. Filtro de Estado SIMIT
    if isinstance(estado_simit, str) and estado_simit.lower() != "todos":
        if estado_simit == "No activo":
            consulta = consulta.where(
                or_(
                    ComparendoORM.estado_simit == "No activo",
                    ComparendoORM.estado_simit == "Pagado"
                )
            )
        else:
            consulta = consulta.where(ComparendoORM.estado_simit == estado_simit)

    # 3. Filtro de Descuentos
    if isinstance(filtro_descuento, str):
        if filtro_descuento == "50":
            consulta = consulta.where(ComparendoORM.aplica_descuento_50 == True)
        elif filtro_descuento == "25":
            consulta = consulta.where(ComparendoORM.aplica_descuento_25 == True)
        elif filtro_descuento == "sin_descuento":
            consulta = consulta.where(
                ComparendoORM.aplica_descuento_50 == False,
                ComparendoORM.aplica_descuento_25 == False
            )

    return consulta


@enrutador_comparendos.get("")
def listar_comparendos(
    pagina: int = Query(1, ge=1, description="Número de página (inicia en 1)"),
    limite: int = Query(5, ge=1, le=5000, description="Cantidad de registros por página (por defecto 5)"),
    busqueda: Optional[str] = Query(None, description="Búsqueda por placa, NIT, comparendo o secretaría"),
    estado_simit: Optional[str] = Query("todos", description="Activo, No activo o todos"),
    filtro_descuento: Optional[str] = Query("todos", description="50, 25, sin_descuento o todos")
) -> Dict[str, Any]:
    """
    Retorna la lista paginada de comparendos con filtros en tiempo real y soporte para
    personalización de registros por página (5, 10, 20, 50 o personalizado).
    """
    pagina_num = pagina if isinstance(pagina, int) else 1
    limite_num = limite if isinstance(limite, int) else 5
    busqueda_str = busqueda if isinstance(busqueda, str) else None
    estado_str = estado_simit if isinstance(estado_simit, str) else "todos"
    filtro_desc_str = filtro_descuento if isinstance(filtro_descuento, str) else "todos"

    try:
        with obtener_sesion_bd() as sesion:
            consulta = construir_consulta_filtrada(busqueda_str, estado_str, filtro_desc_str)

            # Conteo total para paginación
            conteo_stmt = select(func.count()).select_from(consulta.subquery())
            total_registros = sesion.execute(conteo_stmt).scalar() or 0

            # Aplicar ordenamiento, relación con gestión operativa y paginación
            desplazamiento = (pagina_num - 1) * limite_num
            consulta = (
                consulta
                .options(joinedload(ComparendoORM.gestion_operativa))
                .order_by(ComparendoORM.fecha_infraccion.desc().nullslast())
                .offset(desplazamiento)
                .limit(limite_num)
            )

            registros = sesion.scalars(consulta).unique().all()
            lista = [serializar_comparendo(c) for c in registros]
            total_paginas = (total_registros + limite_num - 1) // limite_num if total_registros > 0 else 1

            return {
                "exitoso": True,
                "pagina_actual": pagina_num,
                "limite_por_pagina": limite_num,
                "total_registros": total_registros,
                "total_paginas": total_paginas,
                "comparendos": lista
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar comparendos: {str(e)}")


@enrutador_comparendos.get("/exportar/excel")
@enrutador_comparendos.get("/exportar/resumen")
@enrutador_comparendos.get("/exportar/detallado")
def exportar_comparendos_excel():
    """
    Genera y descarga el archivo Excel (.xlsx) oficial y consolidado de comparendos.
    Exporta SIEMPRE el 100% de los datos registrados en la base de datos sin aplicar filtros de vista.
    """
    try:
        with obtener_sesion_bd() as sesion:
            consulta = (
                select(ComparendoORM)
                .options(joinedload(ComparendoORM.gestion_operativa))
                .order_by(ComparendoORM.fecha_infraccion.desc().nullslast())
            )
            registros = sesion.scalars(consulta).unique().all()

            lista_serializada = [serializar_comparendo(c) for c in registros]
            buffer_excel = generar_excel_resumen(lista_serializada)

            marca_tiempo = datetime.now().strftime("%Y%m%d_%H%M%S")
            nombre_descarga = f"reporte_comparendos_{marca_tiempo}.xlsx"

            return StreamingResponse(
                buffer_excel,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{nombre_descarga}"',
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte Excel: {str(e)}")


@enrutador_comparendos.post("/{id_comparendo}/sincronizar-simit")
def sincronizar_comparendo_simit(
    id_comparendo: int,
    usuario: Optional[str] = Query(None, description="Usuario ejecutor que solicita la sincronización puntual")
) -> Dict[str, Any]:
    """
    Sincroniza un comparendo específico directamente con el portal oficial SIMIT.
    Consulta la placa del vehículo en SIMIT y actualiza ÚNICAMENTE este comparendo
    (o lo marca como 'No activo' si SIMIT confirma que ya no existe deuda o comparendo pendiente).
    Protege todos los demás comparendos del vehículo o de la empresa sin tocarlos.
    """
    try:
        with obtener_sesion_bd() as sesion:
            comp_db = sesion.get(ComparendoORM, id_comparendo)
            if not comp_db:
                raise HTTPException(status_code=404, detail="Comparendo no encontrado")
            
            placa = str(comp_db.placa or "").strip().upper()
            num_comp = str(comp_db.numero_comparendo or "").strip()
            num_res = str(comp_db.numero_resolucion or "").strip()
            id_objetivo = num_comp or num_res

        if not placa or not id_objetivo:
            raise HTTPException(status_code=400, detail="El comparendo no cuenta con placa o número de comparendo válido para consultar en SIMIT.")

        usuario_final = (usuario or "Usuario Web").strip()
        origen_final = "MANUAL_INDIVIDUAL"

        # 1. Disparar extracción dirigida en GitHub Actions (Arquitectura estándar para producción web en la nube)
        from plataforma_web.rutas_api.extraccion import disparar_workflow_github
        try:
            exito_remoto = disparar_workflow_github(
                criterio=placa,
                tipo_consulta="PLACA",
                origen=origen_final,
                usuario=usuario_final,
                numero_comparendo=id_objetivo
            )
            if exito_remoto:
                with obtener_sesion_bd() as sesion:
                    comp_actualizado = (
                        sesion.execute(
                            select(ComparendoORM)
                            .options(joinedload(ComparendoORM.gestion_operativa))
                            .where(ComparendoORM.id == id_comparendo)
                        )
                        .scalars()
                        .first()
                    )
                    datos_serializados = serializar_comparendo(comp_actualizado) if comp_actualizado else {}
                    estado_simit = comp_actualizado.estado_simit if comp_actualizado else "Activo"

                return {
                    "exitoso": True,
                    "modo": "remoto",
                    "mensaje": f"El agente inició la verificación del comparendo {id_objetivo} (Placa {placa}) en SIMIT mediante GitHub Actions. Los datos se actualizarán en breve.",
                    "comparendo": datos_serializados,
                    "estado_simit": estado_simit,
                    "descargado": False
                }
        except Exception as err_remoto:
            logger.warning(f"No fue posible disparar workflow en GitHub Actions ({err_remoto}). Intentando ejecución local...")

        # 2. Fallback a ejecución local con Playwright si la API de GitHub no responde
        from agente_extraccion_simit.extractor_principal import ejecutar_extraccion
        resultado = ejecutar_extraccion(
            criterio=placa,
            tipo_consulta="PLACA",
            sin_interfaz=True,
            origen=origen_final,
            usuario=usuario_final,
            numero_comparendo_objetivo=id_objetivo
        )

        # 3. Consultar el estado actualizado en Supabase
        with obtener_sesion_bd() as sesion:
            comp_actualizado = (
                sesion.execute(
                    select(ComparendoORM)
                    .options(joinedload(ComparendoORM.gestion_operativa))
                    .where(ComparendoORM.id == id_comparendo)
                )
                .scalars()
                .first()
            )

            if not comp_actualizado:
                raise HTTPException(status_code=404, detail="No se pudo recuperar el comparendo tras la sincronización")

            datos_serializados = serializar_comparendo(comp_actualizado)
            es_descargado = comp_actualizado.estado_simit == "No activo"

            if es_descargado:
                mensaje_retorno = f"¡Paz y Salvo confirmado! El comparendo {id_objetivo} de la placa {placa} ya no figura en SIMIT y quedó marcado como 'No activo'."
            elif resultado.exitoso and len(getattr(resultado, "comparendos", [])) > 0:
                mensaje_retorno = f"Comparendo {id_objetivo} (Placa {placa}) verificado y actualizado con la información más reciente de SIMIT."
            else:
                mensaje_retorno = resultado.mensaje_error or "Sincronización finalizada."

            return {
                "exitoso": True,
                "modo": "local",
                "mensaje": mensaje_retorno,
                "comparendo": datos_serializados,
                "estado_simit": comp_actualizado.estado_simit,
                "descargado": es_descargado
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sincronizar comparendo con SIMIT: {str(e)}")


