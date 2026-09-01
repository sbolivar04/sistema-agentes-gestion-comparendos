import os
import json
import urllib.request
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from configuracion import configuracion

enrutador_extraccion = APIRouter(prefix="/api/extraccion", tags=["Extracción SIMIT"])

class SolicitudExtraccion(BaseModel):
    criterio: Optional[str] = Field(None, description="NIT o Placa específica a consultar. Si es vacío, procesa la flota completa.")
    tipo_consulta: Optional[str] = Field("NIT", description="NIT o Placa")

def disparar_workflow_github(criterio: Optional[str] = None, tipo_consulta: str = "NIT") -> bool:
    """Dispara el workflow extraccion_simit.yml en GitHub Actions vía API REST."""
    token = getattr(configuracion, "GITHUB_TOKEN", None) or os.getenv("GITHUB_TOKEN")
    repo = getattr(configuracion, "GITHUB_REPO", None) or os.getenv("GITHUB_REPO", "sbolivar04/sistema-agentes-gestion-comparendos")
    
    if not token:
        raise ValueError("GITHUB_TOKEN no configurado.")

    url = f"https://api.github.com/repos/{repo}/actions/workflows/extraccion_simit.yml/dispatches"
    payload = json.dumps({
        "ref": "main",
        "inputs": {
            "criterio": criterio.strip() if criterio else "",
            "tipo_consulta": tipo_consulta or "NIT"
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
        return resp.status in (200, 201, 204)

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
            from agente_extraccion_simit.extractor_lote import ejecutar_extraccion_lote
            ejecutar_extraccion_lote(sin_interfaz=True)
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
    Consulta en tiempo real si el robot de extracción en GitHub Actions continúa ejecutándose.
    """
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
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            runs = data.get("workflow_runs", [])
            if not runs:
                return {"en_progreso": False, "status": "idle", "conclusion": None}
            
            ultimo_run = runs[0]
            status = ultimo_run.get("status") # 'queued', 'in_progress', 'completed'
            conclusion = ultimo_run.get("conclusion") # 'success', 'failure', etc.
            
            en_progreso = status in ("queued", "in_progress")
            return {
                "exitoso": True,
                "en_progreso": en_progreso,
                "run_id": ultimo_run.get("id"),
                "status": status,
                "conclusion": conclusion,
                "created_at": ultimo_run.get("created_at"),
                "updated_at": ultimo_run.get("updated_at")
            }
    except Exception as e:
        return {"en_progreso": False, "status": "error", "error": str(e)}
