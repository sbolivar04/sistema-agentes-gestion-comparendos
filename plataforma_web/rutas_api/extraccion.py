import os
import json
import urllib.request
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import select, desc

from configuracion import configuracion
from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import LogExtraccionORM, EntidadConsultaORM

logger = logging.getLogger(__name__)

enrutador_extraccion = APIRouter(prefix="/api/extraccion", tags=["Extracción SIMIT"])

# Caché en memoria para evitar consultas repetitivas a la tabla de entidades cada 3 segundos
_cache_entidades_map: Dict[str, str] = {}
_cache_entidades_ts: float = 0.0

def _obtener_mapa_entidades(sesion) -> Dict[str, str]:
    global _cache_entidades_map, _cache_entidades_ts
    ahora = time.time()
    if not _cache_entidades_map or (ahora - _cache_entidades_ts) > 60:
        stmt_ent = select(EntidadConsultaORM)
        _cache_entidades_map = {e.criterio_busqueda: e.nombre_entidad for e in sesion.scalars(stmt_ent).all()}
        _cache_entidades_ts = ahora
    return _cache_entidades_map

class SolicitudExtraccion(BaseModel):
    criterio: Optional[str] = Field(None, description="NIT o Placa específica a consultar. Si es vacío, procesa la flota completa.")
    tipo_consulta: Optional[str] = Field("NIT", description="NIT o Placa")

_ultimo_dispatch_ts: float = 0.0
_ultimo_criterio_solicitado: Optional[str] = None
_ultimo_tipo_solicitado: str = "NIT"
_cache_estado_run: Optional[Dict[str, Any]] = None
_cache_estado_ts: float = 0.0

def disparar_workflow_github(criterio: Optional[str] = None, tipo_consulta: str = "NIT") -> bool:
    """Dispara el workflow extraccion_simit.yml en GitHub Actions vía API REST con protección anti-duplicados."""
    global _ultimo_dispatch_ts, _ultimo_criterio_solicitado, _ultimo_tipo_solicitado
    ahora = time.time()
    
    # Guardar último criterio solicitado para contextualizar mensajes
    _ultimo_criterio_solicitado = criterio.strip() if criterio else None
    _ultimo_tipo_solicitado = "PLACA" if (tipo_consulta or "").strip().upper() == "PLACA" else "NIT"

    # Protección anti-duplicados: si se disparó hace menos de 25 segundos, evitar disparo redundante
    if ahora - _ultimo_dispatch_ts < 25:
        logger.info(f"Disparo ignorado por cooldown anti-duplicados (último disparo hace {int(ahora - _ultimo_dispatch_ts)}s).")
        return True

    token = getattr(configuracion, "GITHUB_TOKEN", None) or os.getenv("GITHUB_TOKEN")
    repo = getattr(configuracion, "GITHUB_REPO", None) or os.getenv("GITHUB_REPO", "sbolivar04/sistema-agentes-gestion-comparendos")
    
    if not token:
        raise ValueError("GITHUB_TOKEN no configurado.")

    url = f"https://api.github.com/repos/{repo}/actions/workflows/extraccion_simit.yml/dispatches"
    payload = json.dumps({
        "ref": "main",
        "inputs": {
            "criterio": _ultimo_criterio_solicitado or "",
            "tipo_consulta": _ultimo_tipo_solicitado
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "FastAPI-FSCR-Comparendos",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status in (200, 201, 204):
            _ultimo_dispatch_ts = ahora
            return True
        return False

@enrutador_extraccion.post("/lanzar")
def lanzar_extraccion(solicitud: SolicitudExtraccion) -> Dict[str, Any]:
    """
    Dispara la extracción en vivo de SIMIT directamente en GitHub Actions y actualiza Supabase en la nube.
    """
    try:
        exito = disparar_workflow_github(
            criterio=solicitud.criterio,
            tipo_consulta=solicitud.tipo_consulta or "NIT"
        )
        if exito:
            criterio_txt = f" de {solicitud.criterio}" if (solicitud.criterio and solicitud.criterio.strip()) else " de toda la flota"
            return {
                "exitoso": True,
                "mensaje": f"El agente inició la consulta de comparendos{criterio_txt} en el SIMIT.",
                "modo": "remoto"
            }
        else:
            return {
                "exitoso": False,
                "mensaje": "No fue posible iniciar la consulta con el agente en este momento."
            }
    except Exception as e:
        # Fallback opcional a ejecución local si falla la API de GitHub
        try:
            if solicitud.criterio and solicitud.criterio.strip():
                from agente_extraccion_simit.extractor_principal import ejecutar_extraccion
                ejecutar_extraccion(solicitud.criterio.strip(), solicitud.tipo_consulta or "NIT", sin_interfaz=True, origen="MANUAL_INDIVIDUAL")
            else:
                from agente_extraccion_simit.extractor_lote import ejecutar_extraccion_lote
                ejecutar_extraccion_lote(sin_interfaz=True, origen="MANUAL_MASIVO")
            return {
                "exitoso": True,
                "mensaje": "Extracción ejecutada en modo local exitosamente.",
                "modo": "local"
            }
        except Exception as err_local:
            raise HTTPException(status_code=500, detail=f"Error al ejecutar extracción: {str(e)} / Local: {str(err_local)}")

@enrutador_extraccion.get("/estado")
def consultar_estado_extraccion() -> Dict[str, Any]:
    """
    Consulta en tiempo real si la extracción en GitHub Actions continúa ejecutándose,
    utilizando caché de 3.5 segundos para evitar saturación de la API de GitHub.
    """
    global _cache_estado_run, _cache_estado_ts
    ahora = time.time()

    # Retornar respuesta en caché si se consultó hace menos de 3.5 segundos
    if _cache_estado_run is not None and (ahora - _cache_estado_ts) < 3.5:
        return _cache_estado_run

    token = getattr(configuracion, "GITHUB_TOKEN", None) or os.getenv("GITHUB_TOKEN")
    repo = getattr(configuracion, "GITHUB_REPO", None) or os.getenv("GITHUB_REPO", "sbolivar04/sistema-agentes-gestion-comparendos")
    
    if not token:
        return {"en_progreso": False, "status": "desconocido", "conclusion": None}

    try:
        url = f"https://api.github.com/repos/{repo}/actions/runs?event=workflow_dispatch&per_page=1"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "FastAPI-FSCR-Comparendos"
            }
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            runs = data.get("workflow_runs", [])
            if not runs:
                return {"en_progreso": False, "status": "idle", "conclusion": None}
            
            ultimo_run = runs[0]
            status = ultimo_run.get("status") # 'queued', 'in_progress', 'completed'
            conclusion = ultimo_run.get("conclusion") # 'success', 'failure', etc.
            en_progreso = status in ("queued", "in_progress")

            # Nombre de la entidad consultada si fue puntual
            with obtener_sesion_bd() as sesion:
                entidades_map = _obtener_mapa_entidades(sesion)
            
            nombre_objetivo = None
            if _ultimo_criterio_solicitado:
                nombre_objetivo = entidades_map.get(_ultimo_criterio_solicitado)
                if not nombre_objetivo:
                    nombre_objetivo = f"{_ultimo_tipo_solicitado} {_ultimo_criterio_solicitado}"

            # Construir mensaje con precisión
            estado_mapeado = "en_progreso" if en_progreso else ("completado" if conclusion == "success" else "error")

            if en_progreso:
                if nombre_objetivo:
                    mensaje_mapeado = f"Estoy consultando en el SIMIT para {nombre_objetivo}... ya casi termino la consulta."
                else:
                    mensaje_mapeado = "Estoy consultando la flota en el SIMIT... ya casi termino la consulta."
            else:
                if conclusion == "failure":
                    estado_mapeado = "error"
                    if nombre_objetivo:
                        mensaje_mapeado = f"Hubo un inconveniente al consultar el portal del SIMIT para {nombre_objetivo}. Puedes volver a intentarlo."
                    else:
                        mensaje_mapeado = "Hubo un inconveniente al consultar el portal del SIMIT. El portal no respondió a tiempo."
                else:
                    estado_mapeado = "completado"
                    if nombre_objetivo:
                        mensaje_mapeado = f"¡Consulta completada con éxito! La información de {nombre_objetivo} ya quedó actualizada en el sistema."
                    else:
                        mensaje_mapeado = "¡Consulta completada con éxito! Toda la flota quedó actualizada en el sistema."

            resultado = {
                "exitoso": True,
                "en_progreso": en_progreso,
                "estado": estado_mapeado,
                "mensaje": mensaje_mapeado,
                "run_id": ultimo_run.get("id"),
                "status": status,
                "conclusion": conclusion,
                "created_at": ultimo_run.get("created_at"),
                "updated_at": ultimo_run.get("updated_at")
            }

            _cache_estado_run = resultado
            _cache_estado_ts = ahora
            return resultado

    except Exception as e:
        logger.warning(f"Consulta de estado a GitHub API demorada ({e}). Manteniendo estado en progreso...")
        # Si GitHub API tiene timeout temporal, no dar error falso a la UI: retornar el último estado conocido o en_progreso
        if _cache_estado_run is not None:
            return _cache_estado_run

        nombre_obj = _ultimo_criterio_solicitado or "la flota"
        return {
            "exitoso": True,
            "en_progreso": True,
            "estado": "en_progreso",
            "mensaje": f"Estoy consultando en el SIMIT para {nombre_obj}... ya casi termino la consulta.",
            "status": "in_progress",
            "conclusion": None
        }
