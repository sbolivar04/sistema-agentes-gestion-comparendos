import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from base_datos.conexion import obtener_sesion_bd
from base_datos.repositorio import RepositorioBaseDatos

logger = logging.getLogger(__name__)

enrutador_entidades = APIRouter(prefix="/api/entidades", tags=["Entidades de Consulta"])

class EsquemaCrearEntidad(BaseModel):
    nombre_entidad: str
    criterio_busqueda: str
    tipo_documento: str = "NIT"
    activo: bool = True

class EsquemaActualizarEntidad(BaseModel):
    nombre_entidad: Optional[str] = None
    criterio_busqueda: Optional[str] = None
    tipo_documento: Optional[str] = None
    activo: Optional[bool] = None

class EsquemaResolverTipo(BaseModel):
    tipo_documento: str

@enrutador_entidades.get("")
def listar_entidades() -> Dict[str, Any]:
    """Obtiene el listado completo de entidades registradas para consulta y estado de alertas."""
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            entidades = repo.obtener_entidades_consulta(solo_activas=False)
            
            items = []
            alertas_pendientes = 0
            for e in entidades:
                if e.requiere_desambiguacion or e.tipo_documento in ["Pendiente", "Sin especificar"]:
                    alertas_pendientes += 1

                items.append({
                    "id": e.id,
                    "nombre_entidad": e.nombre_entidad,
                    "criterio_busqueda": e.criterio_busqueda,
                    "tipo_documento": e.tipo_documento,
                    "activo": e.activo,
                    "requiere_desambiguacion": e.requiere_desambiguacion,
                    "fecha_registro": e.fecha_registro.strftime("%Y-%m-%d %H:%M") if e.fecha_registro else None,
                    "fecha_actualizacion": e.fecha_actualizacion.strftime("%Y-%m-%d %H:%M") if e.fecha_actualizacion else None
                })
            
            return {
                "exitoso": True,
                "total": len(items),
                "alertas_pendientes": alertas_pendientes,
                "entidades": items
            }
    except Exception as e:
        logger.error(f"Error al listar entidades: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener entidades: {str(e)}")

@enrutador_entidades.post("")
def crear_entidad(datos: EsquemaCrearEntidad) -> Dict[str, Any]:
    """Crea una nueva entidad o documento corporativo para consulta."""
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            entidad = repo.crear_entidad_consulta(
                nombre_entidad=datos.nombre_entidad,
                criterio_busqueda=datos.criterio_busqueda,
                tipo_documento=datos.tipo_documento,
                activo=datos.activo
            )
            return {
                "exitoso": True,
                "mensaje": f"Entidad '{entidad.nombre_entidad}' registrada correctamente.",
                "entidad": {
                    "id": entidad.id,
                    "nombre_entidad": entidad.nombre_entidad,
                    "criterio_busqueda": entidad.criterio_busqueda,
                    "tipo_documento": entidad.tipo_documento,
                    "activo": entidad.activo,
                    "requiere_desambiguacion": entidad.requiere_desambiguacion
                }
            }
    except Exception as e:
        logger.error(f"Error al crear entidad: {e}")
        raise HTTPException(status_code=500, detail=f"Error al registrar entidad: {str(e)}")

@enrutador_entidades.put("/{id_entidad}")
def actualizar_entidad(id_entidad: int, datos: EsquemaActualizarEntidad) -> Dict[str, Any]:
    """Actualiza los datos de una entidad existente."""
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            entidad = repo.actualizar_entidad_consulta(
                id_entidad=id_entidad,
                nombre_entidad=datos.nombre_entidad,
                criterio_busqueda=datos.criterio_busqueda,
                tipo_documento=datos.tipo_documento,
                activo=datos.activo
            )
            if not entidad:
                raise HTTPException(status_code=404, detail="Entidad no encontrada.")

            return {
                "exitoso": True,
                "mensaje": f"Entidad '{entidad.nombre_entidad}' actualizada correctamente.",
                "entidad": {
                    "id": entidad.id,
                    "nombre_entidad": entidad.nombre_entidad,
                    "criterio_busqueda": entidad.criterio_busqueda,
                    "tipo_documento": entidad.tipo_documento,
                    "activo": entidad.activo,
                    "requiere_desambiguacion": entidad.requiere_desambiguacion
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al actualizar entidad {id_entidad}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar entidad: {str(e)}")

@enrutador_entidades.delete("/{id_entidad}")
def eliminar_entidad(id_entidad: int) -> Dict[str, Any]:
    """Elimina una entidad de la lista de consultas."""
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            eliminado = repo.eliminar_entidad_consulta(id_entidad)
            if not eliminado:
                raise HTTPException(status_code=404, detail="Entidad no encontrada.")

            return {
                "exitoso": True,
                "mensaje": "Entidad eliminada correctamente."
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al eliminar entidad {id_entidad}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar entidad: {str(e)}")

@enrutador_entidades.post("/{id_entidad}/resolver-tipo")
def resolver_tipo_documento(id_entidad: int, datos: EsquemaResolverTipo) -> Dict[str, Any]:
    """Asigna el tipo de documento (NIT o Cédula) y desactiva la alerta de desambiguación."""
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            entidad = repo.resolver_desambiguacion(id_entidad, datos.tipo_documento)
            if not entidad:
                raise HTTPException(status_code=404, detail="Entidad no encontrada.")

            return {
                "exitoso": True,
                "mensaje": f"Tipo de documento '{datos.tipo_documento}' asignado exitosamente a {entidad.nombre_entidad}.",
                "entidad": {
                    "id": entidad.id,
                    "nombre_entidad": entidad.nombre_entidad,
                    "criterio_busqueda": entidad.criterio_busqueda,
                    "tipo_documento": entidad.tipo_documento,
                    "activo": entidad.activo,
                    "requiere_desambiguacion": entidad.requiere_desambiguacion
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al resolver tipo de entidad {id_entidad}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al resolver tipo de documento: {str(e)}")
