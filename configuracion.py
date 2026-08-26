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
