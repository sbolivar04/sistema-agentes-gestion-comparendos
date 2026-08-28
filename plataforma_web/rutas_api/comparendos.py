from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, or_

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import ComparendoORM

enrutador_comparendos = APIRouter(prefix="/api/comparendos", tags=["Comparendos"])

@enrutador_comparendos.get("")
def listar_comparendos(
    pagina: int = Query(1, ge=1, description="Número de página (inicia en 1)"),
    limite: int = Query(5, ge=1, le=100, description="Cantidad de registros por página (por defecto 5)"),
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
            consulta = select(ComparendoORM)

            # 1. Filtro de búsqueda
            if busqueda and busqueda.strip():
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

            # Conteo total para paginación
            conteo_stmt = select(func.count()).select_from(consulta.subquery())
            total_registros = sesion.execute(conteo_stmt).scalar() or 0

            # Aplicar ordenamiento y paginación
            desplazamiento = (pagina - 1) * limite
            consulta = consulta.order_by(ComparendoORM.fecha_infraccion.desc().nullslast()).offset(desplazamiento).limit(limite)

            registros = sesion.scalars(consulta).all()

            lista = []
            for c in registros:
                # Determinar etiqueta de descuento
                if c.aplica_descuento_50:
                    tag_desc = "50% Vigente"
                    fecha_lim = str(c.fecha_limite_descuento_50)
                    val_pagar = c.valor_con_descuento_50
                elif c.aplica_descuento_25:
                    tag_desc = "25% Vigente"
                    fecha_lim = str(c.fecha_limite_descuento_25)
                    val_pagar = c.valor_con_descuento_25
                else:
                    tag_desc = "Sin Descuento"
                    fecha_lim = "Vencido"
                    val_pagar = c.valor_total

                lista.append({
                    "id": c.id,
                    "numero_comparendo": c.numero_comparendo,
                    "numero_resolucion": c.numero_resolucion,
                    "placa": c.placa,
                    "criterio_busqueda": c.criterio_busqueda,
                    "tipo_registro": c.tipo_registro,
                    "codigo_infraccion": c.codigo_infraccion,
                    "descripcion_infraccion": c.descripcion_infraccion,
                    "secretaria": c.secretaria,
                    "direccion": c.direccion,
                    "fecha_infraccion": c.fecha_infraccion.strftime("%Y-%m-%d %H:%M") if c.fecha_infraccion else "N/A",
                    "fecha_notificacion": c.fecha_notificacion.strftime("%Y-%m-%d") if c.fecha_notificacion else "N/A",
                    "valor_nominal": c.valor,
                    "intereses": c.intereses,
                    "valor_total": c.valor_total,
                    "etiqueta_descuento": tag_desc,
                    "fecha_limite_descuento": fecha_lim,
                    "valor_a_pagar": val_pagar,
                    "ahorro_disponible": c.valor_total - val_pagar if val_pagar else 0,
                    "estado_simit": c.estado_simit
                })

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
