from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from agente_orquestador.motor_gemini import AgenteOrquestadorComparendos

enrutador_chat = APIRouter(prefix="/api/chat", tags=["Chat con IA"])

class SolicitudMensajeChat(BaseModel):
    mensaje: str = Field(..., min_length=1, description="Pregunta del usuario en lenguaje natural")
    modelo: Optional[str] = Field("gemini-3.5-flash-lite", description="Modelo a utilizar")

# Instancia singleton del agente para el chat web
_instancia_agente = None

def _obtener_agente(modelo: str = "gemini-3.5-flash-lite"):
    global _instancia_agente
    if _instancia_agente is None:
        _instancia_agente = AgenteOrquestadorComparendos(modelo=modelo)
    return _instancia_agente

@enrutador_chat.post("")
def procesar_mensaje_chat(solicitud: SolicitudMensajeChat) -> Dict[str, Any]:
    """
    Recibe el mensaje del usuario desde la interfaz web, ejecuta el Agente Orquestador
    con Function Calling / Text-to-SQL y retorna la respuesta en lenguaje natural estructurado.
    """
    try:
        agente = _obtener_agente(solicitud.modelo)
        respuesta = agente.procesar_mensaje(solicitud.mensaje)
        
        return {
            "exitoso": respuesta.exitoso,
            "respuesta": respuesta.texto_respuesta,
            "error": respuesta.mensaje_error
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en chat: {str(e)}")

@enrutador_chat.post("/reiniciar")
def reiniciar_chat() -> Dict[str, Any]:
    """Reinicia el historial de conversación del agente."""
    global _instancia_agente
    if _instancia_agente is not None:
        _instancia_agente.reiniciar_historial()
    return {"exitoso": True, "mensaje": "Historial de conversación reiniciado."}
