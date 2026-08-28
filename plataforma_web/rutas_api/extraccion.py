from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from agente_extraccion_simit.extractor_principal import ejecutar_extraccion
from agente_extraccion_simit.extractor_lote import ejecutar_extraccion_lote

enrutador_extraccion = APIRouter(prefix="/api/extraccion", tags=["Extracción SIMIT"])

class SolicitudExtraccion(BaseModel):
    criterio: Optional[str] = Field(None, description="NIT o Placa específica a consultar. Si es vacío, procesa la flota completa.")
    tipo_consulta: Optional[str] = Field("NIT", description="NIT o Placa")

@enrutador_extraccion.post("/lanzar")
def lanzar_extraccion(solicitud: SolicitudExtraccion) -> Dict[str, Any]:
    """
    Ejecuta una extracción en vivo en el SIMIT y sincroniza la base de datos de Supabase.
    """
    try:
        if solicitud.criterio and solicitud.criterio.strip():
            resultado = ejecutar_extraccion(
                criterio=solicitud.criterio.strip(),
                tipo_consulta=solicitud.tipo_consulta,
                sin_interfaz=True
            )
            if resultado and resultado.exitoso:
                return {
                    "exitoso": True,
                    "mensaje": f"Extracción completada con éxito para {solicitud.criterio}.",
                    "total_comparendos": resultado.total_comparendos,
                    "total_nominal": resultado.total_valor_total,
                    "ahorro_disponible": resultado.total_valor_total - resultado.total_valor_con_descuento_vigente
                }
            else:
                return {
                    "exitoso": False,
                    "mensaje": resultado.mensaje_error if resultado else "Error durante la extracción."
                }
        else:
            # Procesar toda la flota
            ejecutar_extraccion_lote(sin_interfaz=True)
            return {
                "exitoso": True,
                "mensaje": "Extracción en lote finalizada y base de datos actualizada."
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al ejecutar extracción: {str(e)}")
