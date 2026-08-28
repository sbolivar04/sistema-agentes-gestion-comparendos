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
    Agente Orquestador Inteligente con Google Gemini.
    Gestiona Function Calling nativo, Text-to-SQL y razonamiento legal/financiero sobre la flota
    operando estrictamente con temperatura 0.0 para evitar alucinaciones.
    """

    def __init__(self, modelo: str = "gemini-3.5-flash-lite"):
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
        """Inicializa la sesión de chat conversacional con Function Calling activo y temperatura 0.0."""
        config_gen = types.GenerateContentConfig(
            system_instruction=INSTRUCCIONES_SISTEMA_ORQUESTADOR,
            tools=self.herramientas,
            temperature=0.0  # Temperatura 0.0 para máxima precisión y cero invención
        )
        self.chat = self.client.chats.create(
            model=self.modelo,
            config=config_gen
        )
        logger.info(f"Sesión del Agente Orquestador inicializada con modelo: {self.modelo} (Temperatura: 0.0)")

    def procesar_mensaje(self, mensaje_usuario: str) -> EsquemaRespuestaAgente:
        """
        Envía el mensaje del usuario al modelo Gemini, ejecuta las herramientas requeridas y retorna la respuesta.
        Incluye reintento automático con backoff exponencial ante límites de tasa (429) o sobrecarga temporal del servidor (503).
        """
        import time
        max_reintentos = 4
        
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
                es_reintentable = any(cod in error_str for cod in ["429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE", "500"])
                
                if es_reintentable and intento < max_reintentos:
                    tiempo_espera = 4 * (2 ** (intento - 1))  # 4s, 8s, 16s...
                    logger.warning(f"Servicio de IA ocupado ({error_str[:60]}...). Reintentando en {tiempo_espera}s (Intento {intento}/{max_reintentos})...")
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
