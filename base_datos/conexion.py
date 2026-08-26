import logging
from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from configuracion import configuracion
from base_datos.modelos import Base

logger = logging.getLogger(__name__)

# Motor de conexión a Supabase PostgreSQL
motor = create_engine(
    configuracion.DATABASE_URL,
    connect_args={"options": f"-csearch_path={configuracion.DB_SCHEMA},public"},
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False
)

SesionLocal = sessionmaker(autocommit=False, autoflush=False, bind=motor)

def inicializar_base_datos():
    """Inicializa el esquema y crea todas las tablas en Supabase PostgreSQL."""
    try:
        with motor.connect() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {configuracion.DB_SCHEMA};"))
            conn.commit()
        Base.metadata.create_all(bind=motor)
        logger.info(f"Base de datos Supabase inicializada correctamente (Esquema: {configuracion.DB_SCHEMA}).")
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos: {e}")
        raise e

@contextmanager
def obtener_sesion_bd() -> Session:
    """Context manager para sesiones de base de datos seguras con commit/rollback."""
    sesion = SesionLocal()
    try:
        yield sesion
        sesion.commit()
    except Exception as e:
        sesion.rollback()
        logger.error(f"Error en sesión de base de datos (rollback ejecutado): {e}")
        raise e
    finally:
        sesion.close()

# Alias de compatibilidad
init_db = inicializar_base_datos
get_db_session = obtener_sesion_bd
engine = motor
SessionLocal = SesionLocal
