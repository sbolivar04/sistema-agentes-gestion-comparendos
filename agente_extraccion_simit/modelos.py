from datetime import datetime, date
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

class TipoConsulta(str, Enum):
    NIT = "NIT"
    PLACA = "PLACA"

class EstadoComparendo(str, Enum):
    COMPARENDO = "COMPARENDO"
    COACTIVO = "COACTIVO"
    ACUERDO_PAGO = "ACUERDO_PAGO"
    RESOLUCION = "RESOLUCION"
    PAGADO = "PAGADO"
    OTRO = "OTRO"

class EsquemaComparendo(BaseModel):
    numero_resolucion: Optional[str] = Field(None, description="Número de resolución emitido por SIMIT / Secretaría")
    numero_comparendo: str = Field(..., description="Número único de identificación del comparendo de tránsito")
    fecha_infraccion: datetime = Field(..., description="Fecha y hora de la infracción")
    placa: str = Field(..., description="Placa del vehículo asociado")
    criterio_busqueda: Optional[str] = Field(None, description="NIT o Placa utilizada para la búsqueda")
    tipo_registro: Optional[str] = Field("Comparendo", description="Indica si es Comparendo o Multa")
    infractor_documento: Optional[str] = Field(None, description="Documento del infractor / poseedor")
    infractor_nombre: Optional[str] = Field(None, description="Nombre del infractor")
    codigo_infraccion: str = Field(..., description="Código de la infracción (ej. C02, C29)")
    descripcion_infraccion: Optional[str] = Field("", description="Descripción corta del motivo")
    secretaria: str = Field(..., description="Organismo / Secretaría de Tránsito emisora")
    direccion: Optional[str] = Field(None, description="Dirección de la infracción")
    fuente_comparendo: Optional[str] = Field(None, description="Fuente (ej. Organismo de Tránsito)")
    valor: float = Field(0.0, description="Valor nominal de la infracción")
    intereses: float = Field(0.0, description="Intereses generados")
    valor_total: float = Field(0.0, description="Suma de valor e intereses")
    fecha_notificacion: Optional[datetime] = Field(None, description="Fecha de notificación oficial")
    fecha_resolucion: Optional[datetime] = Field(None, description="Fecha de resolución (para multas)")
    es_fotodeteccion: bool = Field(default=False, description="Indica si fue captado por medio tecnológico")

    # Campos calculados dinámicamente por el Motor de Descuentos
    fecha_limite_descuento_50: Optional[date] = None
    valor_con_descuento_50: Optional[float] = None
    fecha_limite_descuento_25: Optional[date] = None
    valor_con_descuento_25: Optional[float] = None
    aplica_descuento_50: bool = False
    aplica_descuento_25: bool = False

    @field_validator("placa", mode="before")
    @classmethod
    def limpiar_placa(cls, v: str) -> str:
        return v.strip().upper() if isinstance(v, str) else v

    @field_validator("numero_comparendo", mode="before")
    @classmethod
    def limpiar_numero(cls, v: str) -> str:
        return str(v).strip() if v is not None else ""

class EsquemaResultadoConsulta(BaseModel):
    criterio_busqueda: str = Field(..., description="NIT o Placa consultada")
    tipo_consulta: TipoConsulta
    fecha_consulta: datetime = Field(default_factory=datetime.now)
    exitoso: bool = True
    total_comparendos: int = 0
    total_valor_total: float = 0.0
    total_valor_con_descuento_vigente: float = 0.0
    comparendos: List[EsquemaComparendo] = Field(default_factory=list)
    mensaje_error: Optional[str] = None

# Alias de compatibilidad
ComparendoSchema = EsquemaComparendo
ResultadoConsultaSchema = EsquemaResultadoConsulta
