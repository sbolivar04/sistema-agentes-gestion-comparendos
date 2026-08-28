import sys
import uvicorn
import logging

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if __name__ == "__main__":
    print("\n" + "=" * 80)
    print(" INICIANDO PLATAFORMA WEB - FSCR INGENIERÍA (SISTEMA MULTIAGENTE SIMIT)")
    print("=" * 80)
    print(" Servidor Backend FastAPI activo en: http://127.0.0.1:8000")
    print(" Documentación Swagger UI en:      http://127.0.0.1:8000/docs")
    print("=" * 80 + "\n")
    
    uvicorn.run("plataforma_web.servidor:app", host="127.0.0.1", port=8000, reload=False)
