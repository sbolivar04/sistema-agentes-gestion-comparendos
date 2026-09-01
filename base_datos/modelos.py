from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    String, Float, Boolean, DateTime, Date, Integer, Text, ForeignKey, Index
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from configuracion import configuracion

class Base(DeclarativeBase):
    pass

Base.metadata.schema = configuracion.DB_SCHEMA

class ComparendoORM(Base):
    """Modelo ORM para almacenar la información detallada de cada comparendo extraído."""
    __tablename__ = "comparendos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    criterio_busqueda: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    tipo_registro: Mapped[Optional[str]] = mapped_column(String(20), default="Comparendo", nullable=True)
    numero_resolucion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    numero_comparendo: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    placa: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    
    fecha_infraccion: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fecha_notificacion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    fecha_resolucion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    codigo_infraccion: Mapped[str] = mapped_column(String(10), nullable=False)
    descripcion_infraccion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    secretaria: Mapped[str] = mapped_column(String(150), nullable=False)
    direccion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fuente_comparendo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    valor: Mapped[float] = mapped_column(Float, nullable=False)
    intereses: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    valor_total: Mapped[float] = mapped_column(Float, nullable=False)
    es_fotodeteccion: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Motor de Descuentos
    fecha_limite_descuento_50: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valor_con_descuento_50: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fecha_limite_descuento_25: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valor_con_descuento_25: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    aplica_descuento_50: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    aplica_descuento_25: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Conciliación SIMIT
    estado_simit: Mapped[str] = mapped_column(String(20), default="Activo", nullable=False)
    fecha_descarga_simit: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Auditoría
    fecha_creacion_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    fecha_ultima_actualizacion: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

class LogExtraccionORM(Base):
    __tablename__ = "logs_extraccion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    criterio_busqueda: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    tipo_consulta: Mapped[str] = mapped_column(String(20), nullable=False)
    fecha_ejecucion: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    registros_encontrados: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    registros_nuevos: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    registros_actualizados: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exitoso: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mensaje_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class PreferenciaConsultaORM(Base):
    """Modelo ORM para almacenar la preferencia de tipo de documento cuando SIMIT encuentra múltiples opciones para un NIT/Cédula."""
    __tablename__ = "preferencias_consulta"

    criterio_busqueda: Mapped[str] = mapped_column(String(50), primary_key=True)
    tipo_documento: Mapped[str] = mapped_column(String(50), nullable=False)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
