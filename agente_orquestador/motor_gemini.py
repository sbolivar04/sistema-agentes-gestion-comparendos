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
    solicitar_actualizacion_simit,
    consultar_estado_extraccion_simit
)

logger = logging.getLogger("MotorGemini")

class AgenteOrquestadorComparendos:
    """
    Agente Orquestador Inteligente con Google Gemini.
    Gestiona Function Calling nativo, Text-to-SQL y razonamiento legal/financiero sobre la flota
    operando estrictamente con temperatura 0.0 para evitar alucinaciones.
    """

    def __init__(self, modelo: Optional[str] = None):
        self.modelo = modelo or configuracion.MODELO_GEMINI
        self.client = genai.Client(api_key=configuracion.GEMINI_API_KEY)
        self.herramientas = [
            consultar_resumen_flota,
            consultar_comparendos_vehiculo,
            consultar_comparendos_empresa,
            analizar_riesgo_descuentos,
            evaluar_posible_prescripcion,
            ejecutar_consulta_sql_segura,
            solicitar_actualizacion_simit,
            consultar_estado_extraccion_simit
        ]
        self._iniciar_chat()

    def _iniciar_chat(self):
        """Inicializa la sesión de chat conversacional con Function Calling activo y temperatura 0.0."""
        config_gen = types.GenerateContentConfig(
            system_instruction=INSTRUCCIONES_SISTEMA_ORQUESTADOR,
            tools=self.herramientas,
            thinking_config=types.ThinkingConfig(thinking_budget=0),  # Elimina cobro de tokens de razonamiento
            temperature=0.0  # Temperatura 0.0 para máxima precisión y cero invención
        )
        self.chat = self.client.chats.create(
            model=self.modelo,
            config=config_gen
        )
        logger.info(f"Sesión del Agente Orquestador inicializada con modelo: {self.modelo} (Temperatura: 0.0, Thinking: 0)")

    def _es_mensaje_usuario_real(self, contenido: Any) -> bool:
        """Verifica si un objeto Content corresponde a una pregunta real del usuario y no a la respuesta de una función."""
        if not contenido or getattr(contenido, "role", None) != "user":
            return False
        for parte in getattr(contenido, "parts", []) or []:
            if getattr(parte, "function_response", None) is not None:
                return False
        return True

    def _podar_historial(self, max_turnos_usuario: int = 3):
        """
        Mantiene una ventana deslizante de turnos completos en memoria.
        Garantiza que el historial siempre comience con una pregunta real del usuario
        y nunca rompa la secuencia estricta de (llamada_a_funcion -> respuesta_de_funcion) de Gemini.
        """
        try:
            historial_curado = getattr(self.chat, "_curated_history", None)
            if not historial_curado:
                return

            # Identificar los índices de los mensajes donde el usuario hizo una pregunta real
            indices_turnos_usuario = [
                i for i, c in enumerate(historial_curado)
                if self._es_mensaje_usuario_real(c)
            ]

            # Si excedemos el límite de turnos conversacionales completos
            if len(indices_turnos_usuario) > max_turnos_usuario:
                indice_inicio = indices_turnos_usuario[-max_turnos_usuario]
                historial_podado = list(historial_curado[indice_inicio:])
                self.chat._curated_history = historial_podado
                self.chat._comprehensive_history = list(historial_podado)
                logger.info(f"Historial podado exitosamente. Se conservaron los últimos {max_turnos_usuario} turnos ({len(historial_podado)} elementos).")
        except Exception as e_poda:
            logger.warning(f"Aviso al podar historial de conversación: {e_poda}")

    def procesar_mensaje(self, mensaje_usuario: str) -> EsquemaRespuestaAgente:
        """
        Envía el mensaje del usuario al modelo Gemini, ejecuta las herramientas requeridas y retorna la respuesta.
        Incluye reintento automático con backoff exponencial ante límites de tasa (429) o sobrecarga temporal del servidor (503),
        y auto-recuperación si el historial llega a desincronizarse.
        """
        import time
        max_reintentos = 4
        
        for intento in range(1, max_reintentos + 1):
            try:
                logger.info(f"Usuario: '{mensaje_usuario}'")
                respuesta = self.chat.send_message(mensaje_usuario)
                self._podar_historial(max_turnos_usuario=3)
                
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
                
                # Si ocurre un error de desincronización de llamadas a función (400 INVALID_ARGUMENT),
                # reiniciamos la sesión automáticamente para evitar que el agente quede bloqueado indefinidamente.
                if "function response turn" in error_str or "INVALID_ARGUMENT" in error_str:
                    logger.warning("Detectada desincronización en el historial de llamadas a función de Gemini. Reiniciando historial y recuperando sesión...")
                    self.reiniciar_historial()
                    if intento < max_reintentos:
                        try:
                            respuesta_recuperada = self.chat.send_message(mensaje_usuario)
                            self._podar_historial(max_turnos_usuario=3)
                            texto = respuesta_recuperada.text if respuesta_recuperada.text else "No se generó texto de respuesta."
                            return EsquemaRespuestaAgente(
                                texto_respuesta=texto,
                                exitoso=True
                            )
                        except Exception as e_rec:
                            logger.error(f"Fallo en reintento tras reiniciar historial: {e_rec}")

                logger.error(f"Error procesando mensaje en Gemini: {e}")
                return EsquemaRespuestaAgente(
                    texto_respuesta=f"Ocurrió un error al procesar tu solicitud con el Agente Inteligente: {str(e)}",
                    exitoso=False,
                    mensaje_error=str(e)
                )

    def reiniciar_historial(self):
        """Reinicia el historial de conversación."""
        self._iniciar_chat()
