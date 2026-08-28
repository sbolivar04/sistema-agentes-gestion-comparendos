from datetime import datetime, date
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class TipoIntencion(str, Enum):
    RESUMEN_GENERAL = "RESUMEN_GENERAL"
    CONSULTA_VEHICULO = "CONSULTA_VEHICULO"
    CONSULTA_EMPRESA = "CONSULTA_EMPRESA"
    ANALISIS_DESCUENTOS = "ANALISIS_DESCUENTOS"
    ANALISIS_PRESCRIPCION = "ANALISIS_PRESCRIPCION"
    CONSULTA_SQL = "CONSULTA_SQL"
    EXTRACCION_EN_VIVO = "EXTRACCION_EN_VIVO"
    OTRO = "OTRO"

class EsquemaMensajeChat(BaseModel):
    rol: str = Field(..., description="user o model / assistant")
    contenido: str = Field(..., description="Texto del mensaje")
    timestamp: datetime = Field(default_factory=datetime.now)

class EsquemaRespuestaAgente(BaseModel):
    texto_respuesta: str
    herramientas_utilizadas: List[str] = Field(default_factory=list)
    datos_estructurados: Optional[Dict[str, Any]] = None
    exitoso: bool = True
    mensaje_error: Optional[str] = None
