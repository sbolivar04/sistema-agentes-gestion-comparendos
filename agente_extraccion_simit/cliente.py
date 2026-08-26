import logging
from agente_extraccion_simit.modelos import EsquemaResultadoConsulta, TipoConsulta
from agente_extraccion_simit.cliente_navegador import ClienteNavegadorSimit

logger = logging.getLogger(__name__)

class ClienteSimit:
    """
    Cliente oficial de extracción de comparendos de tránsito desde el portal SIMIT.
    Utiliza automatización web en vivo con Playwright.
    """

    def __init__(self, sin_interfaz: bool = False, headless: bool = None):
        modo_oculto = sin_interfaz if headless is None else headless
        self.cliente_navegador = ClienteNavegadorSimit(headless=modo_oculto)

    def consultar_por_nit(self, nit: str) -> EsquemaResultadoConsulta:
        """Consulta en tiempo real en SIMIT por el NIT de la empresa."""
        logger.info(f"Iniciando consulta masiva en vivo para NIT: {nit}")
        return self.cliente_navegador.consultar_en_vivo(nit, tipo_consulta="NIT")

    def consultar_por_placa(self, placa: str) -> EsquemaResultadoConsulta:
        """Consulta en tiempo real en SIMIT por la Placa del vehículo."""
        logger.info(f"Iniciando consulta puntual en vivo para Placa: {placa}")
        return self.cliente_navegador.consultar_en_vivo(placa, tipo_consulta="PLACA")

# Alias de compatibilidad
SimitClient = ClienteSimit
