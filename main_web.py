import os
import sys
import uvicorn
import logging

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if __name__ == "__main__":
    # Configuración de red: En producción (Render/Docker) usa 0.0.0.0 y el puerto $PORT asignado
    host = os.getenv("HOST", "0.0.0.0")
    puerto = int(os.getenv("PORT", 8000))
    
    # Modo de recarga: Activo en local por defecto, desactivado en producción si DEPURACION=false
    es_produccion = os.getenv("RENDER", "").lower() in ("true", "1") or os.getenv("DEPURACION", "true").lower() in ("false", "0", "no")
    recargar_automaticamente = not es_produccion

    print("\n" + "=" * 80)
    print(" INICIANDO PLATAFORMA WEB - FSCR INGENIERÍA (SISTEMA MULTIAGENTE SIMIT)")
    print("=" * 80)
    print(f" Servidor Backend FastAPI activo en: http://{host}:{puerto}")
    print(f" Documentación Swagger UI en:      http://{host}:{puerto}/docs")
    print(f" Modo Producción: {'SÍ' if es_produccion else 'NO (Desarrollo Local con Auto-reload)'}")
    print("=" * 80 + "\n")
    
    uvicorn.run(
        "plataforma_web.servidor:app",
        host=host,
        port=puerto,
        reload=recargar_automaticamente
    )

