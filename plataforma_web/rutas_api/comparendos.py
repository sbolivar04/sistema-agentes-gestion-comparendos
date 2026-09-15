from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, or_

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM
from plataforma_web.utilidades_exportacion import generar_excel_resumen, generar_excel_detallado

enrutador_comparendos = APIRouter(prefix="/api/comparendos", tags=["Comparendos"])

def serializar_comparendo(c: ComparendoORM) -> Dict[str, Any]:
    """
    Serializa un registro ORM de comparendo con todos los campos canónicos requeridos
    por la plataforma web (tabla, modales emergentes y notificaciones).
    """
    tipo_str = str(c.tipo_registro or "").strip().lower()
    tiene_resolucion = bool(c.fecha_resolucion)
    tiene_intereses = bool(c.intereses and float(c.intereses) > 0)
    es_multa = (tipo_str == "multa") or tiene_resolucion or tiene_intereses
    es_foto = bool(c.es_fotodeteccion)

    if es_multa:
        # Multa / Resolución en firme / Intereses causados: Tarifa plena 100% sin beneficio
        tag_desc = "Sin Descuento"
        fecha_lim = "Vencido"
        val_pagar = c.valor_total
    elif c.aplica_descuento_50:
        if c.fecha_limite_descuento_50:
            tag_desc = "50% Vigente"
            fecha_lim = str(c.fecha_limite_descuento_50)
        else:
            tag_desc = "50% (Sin Notificar)" if es_foto else "50% Vigente"
            fecha_lim = "Pendiente Notificación" if es_foto else "Vencido"
        val_pagar = c.valor_con_descuento_50
    elif c.aplica_descuento_25:
        if c.fecha_limite_descuento_25:
            tag_desc = "25% Vigente"
            fecha_lim = str(c.fecha_limite_descuento_25)
        else:
            tag_desc = "25% Vigente"
            fecha_lim = "Vencido"
        val_pagar = c.valor_con_descuento_25
    else:
        tag_desc = "Sin Descuento"
        fecha_lim = "Vencido"
        val_pagar = c.valor_total

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
        "valor_total": round(float(c.valor_total)) if c.valor_total else 0,
        "etiqueta_descuento": tag_desc,
        "fecha_limite_descuento": fecha_lim,
        "valor_a_pagar": round(float(val_pagar)) if val_pagar else 0,
        "ahorro_disponible": round(float(c.valor_total - val_pagar)) if (val_pagar and c.valor_total and not es_multa) else 0,
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
    if busqueda and busqueda.strip():
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
    if estado_simit and estado_simit.lower() != "todos":
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
    try:
        with obtener_sesion_bd() as sesion:
            consulta = construir_consulta_filtrada(busqueda, estado_simit, filtro_descuento)

            # Conteo total para paginación
            conteo_stmt = select(func.count()).select_from(consulta.subquery())
            total_registros = sesion.execute(conteo_stmt).scalar() or 0

            # Aplicar ordenamiento y paginación
            desplazamiento = (pagina - 1) * limite
            consulta = consulta.order_by(ComparendoORM.fecha_infraccion.desc().nullslast()).offset(desplazamiento).limit(limite)

            registros = sesion.scalars(consulta).all()
            lista = [serializar_comparendo(c) for c in registros]
            total_paginas = (total_registros + limite - 1) // limite if total_registros > 0 else 1

            return {
                "exitoso": True,
                "pagina_actual": pagina,
                "limite_por_pagina": limite,
                "total_registros": total_registros,
                "total_paginas": total_paginas,
                "comparendos": lista
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar comparendos: {str(e)}")


@enrutador_comparendos.get("/exportar/resumen")
def exportar_comparendos_resumen(
    busqueda: Optional[str] = Query(None, description="Búsqueda activa"),
    estado_simit: Optional[str] = Query("todos", description="Estado SIMIT filtrado"),
    filtro_descuento: Optional[str] = Query("todos", description="Descuento filtrado")
):
    """
    Genera y descarga un archivo Excel (.xlsx) con el reporte ejecutivo y operativo resumido.
    Respeta los filtros activos en la vista de la tabla.
    """
    try:
        with obtener_sesion_bd() as sesion:
            consulta = construir_consulta_filtrada(busqueda, estado_simit, filtro_descuento)
            consulta = consulta.order_by(ComparendoORM.fecha_infraccion.desc().nullslast())
            registros = sesion.scalars(consulta).all()

            lista_serializada = [serializar_comparendo(c) for c in registros]
            buffer_excel = generar_excel_resumen(lista_serializada)

            marca_tiempo = datetime.now().strftime("%Y%m%d_%H%M%S")
            nombre_descarga = f"reporte_comparendos_resumen_{marca_tiempo}.xlsx"

            return StreamingResponse(
                buffer_excel,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{nombre_descarga}"',
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte Excel resumen: {str(e)}")


@enrutador_comparendos.get("/exportar/detallado")
def exportar_comparendos_detallado(
    busqueda: Optional[str] = Query(None, description="Búsqueda activa"),
    estado_simit: Optional[str] = Query("todos", description="Estado SIMIT filtrado"),
    filtro_descuento: Optional[str] = Query("todos", description="Descuento filtrado")
):
    """
    Genera y descarga un archivo Excel (.xlsx) exhaustivo con toda la información técnica,
    jurídica y operativa de los comparendos y multas.
    """
    try:
        with obtener_sesion_bd() as sesion:
            consulta = construir_consulta_filtrada(busqueda, estado_simit, filtro_descuento)
            consulta = consulta.order_by(ComparendoORM.fecha_infraccion.desc().nullslast())
            registros = sesion.scalars(consulta).all()

            lista_serializada = [serializar_comparendo(c) for c in registros]
            buffer_excel = generar_excel_detallado(lista_serializada)

            marca_tiempo = datetime.now().strftime("%Y%m%d_%H%M%S")
            nombre_descarga = f"reporte_comparendos_detallado_{marca_tiempo}.xlsx"

            return StreamingResponse(
                buffer_excel,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{nombre_descarga}"',
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reporte Excel detallado: {str(e)}")

