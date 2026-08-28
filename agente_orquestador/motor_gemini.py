import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

from configuracion import configuracion
from agente_orquestador.prompts_sistema import INSTRUCCIONES_SISTEMA_ORQUESTADOR
from agente_orquestador.modelos import EsquemaRespuestaAgente
from agente_orquestador.herramientas import (
    consultar_resumen_flota,
    consultar_comparendos_vehiculo,
    consultar_comparendos_empresa,
    analizar_riesgo_descuentos,
    evaluar_posible_prescripcion,
    ejecutar_consulta_sql_segura,
    solicitar_extraccion_en_vivo
)

logger = logging.getLogger("MotorGemini")

class AgenteOrquestadorComparendos:
    """
    Agente Orquestador Inteligente con Google Gemini (gemini-3.6-flash).
    Gestiona Function Calling nativo, Text-to-SQL y razonamiento legal/financiero sobre la flota.
    """

    def __init__(self, modelo: str = "gemini-3.6-flash"):
        self.modelo = modelo
        self.client = genai.Client(api_key=configuracion.GEMINI_API_KEY)
        self.herramientas = [
            consultar_resumen_flota,
            consultar_comparendos_vehiculo,
            consultar_comparendos_empresa,
            analizar_riesgo_descuentos,
            evaluar_posible_prescripcion,
            ejecutar_consulta_sql_segura,
            solicitar_extraccion_en_vivo
        ]
        self._iniciar_chat()

    def _iniciar_chat(self):
        """Inicializa la sesión de chat conversacional con Function Calling activo."""
        config_gen = types.GenerateContentConfig(
            system_instruction=INSTRUCCIONES_SISTEMA_ORQUESTADOR,
            tools=self.herramientas,
            temperature=0.2
        )
        self.chat = self.client.chats.create(
            model=self.modelo,
            config=config_gen
        )
        logger.info(f"Sesión del Agente Orquestador inicializada con modelo: {self.modelo}")

    def procesar_mensaje(self, mensaje_usuario: str) -> EsquemaRespuestaAgente:
        """
        Envía el mensaje del usuario al modelo Gemini, ejecuta las herramientas requeridas y retorna la respuesta.
        Incluye reintento automático si se alcanza el límite por minuto de la API.
        """
        import time
        max_reintentos = 3
        
        for intento in range(1, max_reintentos + 1):
            try:
                logger.info(f"Usuario: '{mensaje_usuario}'")
                respuesta = self.chat.send_message(mensaje_usuario)
                
                texto = respuesta.text if respuesta.text else "No se generó texto de respuesta."
                
                return EsquemaRespuestaAgente(
                    texto_respuesta=texto,
                    exitoso=True
                )
            except Exception as e:
                error_str = str(e)
                if ("429" in error_str or "RESOURCE_EXHAUSTED" in error_str) and intento < max_reintentos:
                    tiempo_espera = 10 * intento
                    logger.warning(f"Límite de tasa temporal alcanzado. Reintentando en {tiempo_espera}s... (Intento {intento}/{max_reintentos})")
                    time.sleep(tiempo_espera)
                    continue
                
                logger.error(f"Error procesando mensaje en Gemini: {e}")
                return EsquemaRespuestaAgente(
                    texto_respuesta=f"Ocurrió un error al procesar tu solicitud con el Agente Inteligente: {str(e)}",
                    exitoso=False,
                    mensaje_error=str(e)
                )

    def reiniciar_historial(self):
        """Reinicia el historial de conversación."""
        self._iniciar_chat()
