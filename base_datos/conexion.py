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
    pool_size=5,
    max_overflow=5,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False
)

SesionLocal = sessionmaker(autocommit=False, autoflush=False, bind=motor)

def inicializar_base_datos():
    """Inicializa el esquema, crea todas las tablas y asegura la publicación en Supabase Realtime."""
    try:
        with motor.connect() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {configuracion.DB_SCHEMA};"))
            conn.commit()
        Base.metadata.create_all(bind=motor)

        # Garantizar permisos y publicación en Supabase Realtime
        with motor.connect() as conn:
            try:
                conn.execute(text(f"""
                    GRANT USAGE ON SCHEMA {configuracion.DB_SCHEMA} TO anon, authenticated, service_role;
                    GRANT SELECT ON ALL TABLES IN SCHEMA {configuracion.DB_SCHEMA} TO anon, authenticated, service_role;
                    ALTER DEFAULT PRIVILEGES IN SCHEMA {configuracion.DB_SCHEMA} GRANT SELECT ON TABLES TO anon, authenticated, service_role;
                    ALTER TABLE {configuracion.DB_SCHEMA}.comparendos REPLICA IDENTITY FULL;
                    ALTER TABLE {configuracion.DB_SCHEMA}.gestiones_operativas REPLICA IDENTITY FULL;
                    ALTER TABLE {configuracion.DB_SCHEMA}.logs_extraccion REPLICA IDENTITY FULL;
                """))
                conn.commit()
            except Exception as e_perm:
                logger.warning(f"Aviso al configurar permisos o replica identity: {e_perm}")

            for tabla in ["comparendos", "gestiones_operativas", "logs_extraccion"]:
                try:
                    conn.execute(text(f"ALTER PUBLICATION supabase_realtime ADD TABLE {configuracion.DB_SCHEMA}.{tabla};"))
                    conn.commit()
                except Exception:
                    # Si ya está añadida en la publicación de Supabase Realtime, omitir
                    pass

        logger.info(f"Base de datos Supabase inicializada y configurada con Realtime (Esquema: {configuracion.DB_SCHEMA}).")
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
