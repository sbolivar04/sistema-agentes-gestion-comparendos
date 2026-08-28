import sys
import logging
from pathlib import Path

DIRECTORIO_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DIRECTORIO_BASE))

from agente_orquestador.motor_gemini import AgenteOrquestadorComparendos

logging.basicConfig(
    level=logging.WARNING, # Reducir ruido en la consola interactiva
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("OrquestadorCLI")

def iniciar_consola_conversacional():
    """Lanza la interfaz conversacional del Agente Orquestador por terminal."""
    print("\n" + "=" * 80)
    print("      🧠 AGENTE ORQUESTADOR INTELIGENTE - IA FLOTAS CORPORATIVAS (SIMIT)     ")
    print("=" * 80)
    print(" Bienvenido al consultor inteligente de comparendos de tránsito en Colombia.")
    print(" Puedes hacer preguntas en lenguaje natural sobre:")
    print("  • Resumen general y ahorro potencial disponible en la flota.")
    print("  • Consulta de infracciones por placa específica (ej. '¿Qué multas tiene el carro WNQ706?').")
    print("  • Análisis de descuentos del 50% y 25% próximos a vencer.")
    print("  • Evaluación de comparendos con más de 3 años para solicitar prescripción.")
    print("  • Consultas analíticas personalizadas (Text-to-SQL).")
    print(" Escribe 'salir' o 'exit' para terminar la sesión, o 'limpiar' para reiniciar.")
    print("=" * 80 + "\n")

    agente = AgenteOrquestadorComparendos()

    while True:
        try:
            prompt_usuario = input("\n👤 Tú: ").strip()
            if not prompt_usuario:
                continue

            if prompt_usuario.lower() in ["salir", "exit", "quit", "chao"]:
                print("\n Sesión finalizada. ¡Hasta luego!")
                break

            if prompt_usuario.lower() in ["limpiar", "reiniciar", "reset", "clear"]:
                agente.reiniciar_historial()
                print("\n [INFO] Historial de conversación reiniciado.")
                continue

            print("\n🤖 Agente Inteligente (Gemini): Consultando y analizando...")
            respuesta = agente.procesar_mensaje(prompt_usuario)
            print("\n" + "-" * 80)
            print(respuesta.texto_respuesta)
            print("-" * 80)

        except (KeyboardInterrupt, EOFError):
            print("\n Sesión terminada por el usuario.")
            break
        except Exception as e:
            print(f"\n[ERROR]: {e}")

if __name__ == "__main__":
    iniciar_consola_conversacional()
