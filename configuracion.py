import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

DIRECTORIO_BASE = Path(__file__).resolve().parent

class Configuracion(BaseSettings):
    NOMBRE_APP: str = "Sistema Inteligente Agentes SIMIT"
    DEPURACION: bool = True
    
    # URLs Base de SIMIT
    URL_BASE_SIMIT: str = "https://www.fcm.org.co/simit/"
    ENDPOINT_API_SIMIT: str = "https://www.fcm.org.co/simit/RespuestaConsulta"
    
    # Parámetros de Extracción
    TIEMPO_ESPERA_SOLICITUD: int = 30
    MAX_REINTENTOS: int = 3
    AGENTE_USUARIO: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/127.0.0.0 Safari/537.36"
    )
    
    # Configuración de Base de Datos (Supabase / PostgreSQL vía .env)
    DATABASE_URL: str = ""
    DB_SCHEMA: str = "comparendos_fscr"
    SUPABASE_URL: str = ""
    GEMINI_API_KEY: str = ""
    
    # Configuración de GitHub Actions para ejecución en la nube
    GITHUB_TOKEN: str = ""
    GITHUB_REPO: str = "sbolivar04/sistema-agentes-gestion-comparendos"
    
    # Reglas de Negocio Ley Colombiana
    DIAS_HABILES_DESCUENTO_50: int = 11
    DIAS_HABILES_DESCUENTO_25: int = 25
    PORCENTAJE_DESCUENTO_1: float = 0.50
    PORCENTAJE_DESCUENTO_2: float = 0.25

    model_config = SettingsConfigDict(
        env_file=str(DIRECTORIO_BASE / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

configuracion = Configuracion()

from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo

ZONA_HORARIA_COLOMBIA = ZoneInfo("America/Bogota")

def obtener_ahora_colombia() -> datetime:
    """Retorna fecha y hora actual garantizada en horario de Colombia (America/Bogota)."""
    return datetime.now(ZONA_HORARIA_COLOMBIA)

def formatear_fecha_colombia(dt: datetime) -> str:
    """
    Convierte timestamps almacenados en UTC en Supabase/PostgreSQL 
    a la zona horaria oficial de Colombia (UTC-5 / America/Bogota).
    """
    if not dt:
        return "Pendiente"
    if dt.tzinfo is None:
        dt_utc = dt.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt.astimezone(timezone.utc)
    
    dt_col = dt_utc.astimezone(ZONA_HORARIA_COLOMBIA)
    
    meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    mes_str = meses[dt_col.month - 1]
    hora_str = dt_col.strftime("%I:%M %p").lstrip('0')
    return f"{dt_col.day} {mes_str} • {hora_str}"
