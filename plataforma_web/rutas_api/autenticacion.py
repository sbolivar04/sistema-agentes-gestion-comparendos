import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from base_datos.conexion import obtener_sesion_bd
from base_datos.repositorio import RepositorioBaseDatos

logger = logging.getLogger(__name__)

enrutador_autenticacion = APIRouter(
    prefix="/api/autenticacion",
    tags=["Autenticación de Usuarios FSCR"]
)

class SolicitudInicioSesion(BaseModel):
    email: str = Field(..., description="Correo electrónico corporativo")
    contrasena: str = Field(..., description="Contraseña de acceso del usuario")

@enrutador_autenticacion.post("/iniciar-sesion")
def iniciar_sesion(solicitud: SolicitudInicioSesion) -> Dict[str, Any]:
    """
    Autentica un usuario contra la tabla comparendos_fscr.usuarios usando verificación SHA-256.
    Retorna la información del perfil y rol del usuario si las credenciales son válidas.
    """
    email_limpio = (solicitud.email or "").strip().lower()
    contrasena_limpia = (solicitud.contrasena or "").strip()

    if not email_limpio or not contrasena_limpia:
        raise HTTPException(
            status_code=400,
            detail="El correo electrónico y la contraseña son obligatorios."
        )

    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            usuario_db = repo.autenticar_usuario(email_limpio, contrasena_limpia)

            if not usuario_db:
                logger.warning(f"Intento de inicio de sesión fallido para: {email_limpio}")
                return {
                    "exitoso": False,
                    "error": "Credenciales inválidas o usuario inactivo en el sistema."
                }

            logger.info(f"Inicio de sesión exitoso: {usuario_db.email} ({usuario_db.rol})")
            return {
                "exitoso": True,
                "usuario": {
                    "id": usuario_db.id,
                    "nombre": usuario_db.nombre,
                    "email": usuario_db.email,
                    "rol": usuario_db.rol,
                    "activo": usuario_db.activo
                }
            }
    except Exception as e:
        logger.error(f"Error al autenticar usuario {email_limpio}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error en el servidor de autenticación: {str(e)}"
        )
