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

    def consultar_lote(self, lista_consultas: list, callback_procesamiento=None) -> list:
        """
        Consulta en tiempo real en SIMIT para una lista de entidades en una sola sesión continua.
        Abre el portal una sola vez, cierra anuncios iniciales y reutiliza la barra superior de búsqueda.
        """
        logger.info(f"Iniciando consulta en lote continua para {len(lista_consultas)} entidades...")
        return self.cliente_navegador.consultar_lote_en_vivo(lista_consultas, callback_procesamiento)

# Alias de compatibilidad
SimitClient = ClienteSimit
