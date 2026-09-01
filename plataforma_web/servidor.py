import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from plataforma_web.rutas_api.kpis import enrutador_kpis
from plataforma_web.rutas_api.estadisticas import enrutador_estadisticas
from plataforma_web.rutas_api.alertas import enrutador_alertas
from plataforma_web.rutas_api.comparendos import enrutador_comparendos
from plataforma_web.rutas_api.chat import enrutador_chat
from plataforma_web.rutas_api.extraccion import enrutador_extraccion

# Version 1.0.1 - Sincronizacion en tiempo real activa
app = FastAPI(
    title="Sistema de Gestión y Seguimiento de Comparendos SIMIT - FSCR Ingeniería",
    description="Plataforma de Inteligencia Artificial y Dashboard para Flotas Corporativas",
    version="1.0.1"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar enrutadores de API
app.include_router(enrutador_kpis)
app.include_router(enrutador_estadisticas)
app.include_router(enrutador_alertas)
app.include_router(enrutador_comparendos)
app.include_router(enrutador_chat)
app.include_router(enrutador_extraccion)

DIRECTORIO_RAIZ = Path(__file__).resolve().parent
DIRECTORIO_DIST_CLIENTE = DIRECTORIO_RAIZ / "cliente" / "dist"

# Servir aplicación de React compilada si existe
if DIRECTORIO_DIST_CLIENTE.exists():
    app.mount("/assets", StaticFiles(directory=str(DIRECTORIO_DIST_CLIENTE / "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def servir_spa(full_path: str):
        archivo_solicitado = DIRECTORIO_DIST_CLIENTE / full_path
        if archivo_solicitado.exists() and archivo_solicitado.is_file():
            return FileResponse(archivo_solicitado)
        return FileResponse(DIRECTORIO_DIST_CLIENTE / "index.html")
else:
    @app.get("/")
    def inicio_api():
        return {
            "mensaje": "Servidor Backend FastAPI de Gestión de Comparendos FSCR activo.",
            "documentacion": "/docs",
            "api_kpis": "/api/kpis",
            "api_alertas": "/api/alertas",
            "api_comparendos": "/api/comparendos"
        }
