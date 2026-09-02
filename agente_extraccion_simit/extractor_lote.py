import os
import sys
import logging
from pathlib import Path

DIRECTORIO_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DIRECTORIO_BASE))

from base_datos.conexion import inicializar_base_datos, obtener_sesion_bd
from base_datos.repositorio import RepositorioBaseDatos
from agente_extraccion_simit.extractor_principal import ejecutar_extraccion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ExtractorLote")

def obtener_entidades_activas() -> list[dict]:
    """Obtiene la lista de entidades y documentos activos desde la base de datos Supabase."""
    entidades = []
    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            registros = repo.obtener_entidades_consulta(solo_activas=True)
            for r in registros:
                entidades.append({
                    "id": r.id,
                    "empresa": r.nombre_entidad,
                    "criterio": r.criterio_busqueda,
                    "tipo_documento": r.tipo_documento or "NIT"
                })
    except Exception as e:
        logger.error(f"Error al consultar entidades activas en Supabase: {e}")

    # Fallback de seguridad si la base de datos estuviera vacía
    if not entidades:
        entidades = [
            {"id": 1, "empresa": "FSCR Ingeniería S.A.S", "criterio": "900160091", "tipo_documento": "NIT"},
            {"id": 2, "empresa": "Servicios y Apoyo Total S.A.S.", "criterio": "901818414", "tipo_documento": "NIT"},
            {"id": 3, "empresa": "Maste Servicios Integrales S A S", "criterio": "9005285051", "tipo_documento": "NIT"}
        ]

    return entidades

def ejecutar_extraccion_lote(sin_interfaz: bool = True):
    """Ejecuta la extracción secuencial para todas las entidades activas de la flota corporativa."""
    logger.info("=" * 80)
    logger.info(" INICIANDO EXTRACCIÓN AUTOMÁTICA EN LOTE PARA FLOTA CORPORATIVA")
    logger.info("=" * 80)

    # 1. Asegurar base de datos inicializada
    inicializar_base_datos()

    # 2. Cargar entidades desde Supabase
    empresas = obtener_entidades_activas()
    logger.info(f"Se encontraron {len(empresas)} entidades activas en Supabase para procesar.")

    totales = {
        "empresas_procesadas": 0,
        "total_comparendos": 0,
        "total_valor": 0.0,
        "total_ahorro": 0.0,
        "errores": 0
    }

    for idx, item in enumerate(empresas, 1):
        empresa = item["empresa"]
        criterio = item.get("criterio") or item.get("nit")
        tipo_doc = item.get("tipo_documento") or "NIT"
        logger.info(f"\n[{idx}/{len(empresas)}] Procesando {empresa} ({tipo_doc}: {criterio})...")

        try:
            resultado = ejecutar_extraccion(criterio=criterio, tipo_consulta=tipo_doc, sin_interfaz=sin_interfaz)
            if resultado and resultado.exitoso:
                totales["empresas_procesadas"] += 1
                totales["total_comparendos"] += resultado.total_comparendos
                totales["total_valor"] += resultado.total_valor_total
                totales["total_ahorro"] += (resultado.total_valor_total - resultado.total_valor_con_descuento_vigente)
            else:
                totales["errores"] += 1
        except Exception as e:
            logger.error(f"Error procesando {tipo_doc} {criterio} ({empresa}): {e}")
            totales["errores"] += 1

    # 3. Resumen final consolidado
    print("\n" + "=" * 80)
    print("      RESUMEN FINAL DE LA EXTRACCIÓN EN LOTE (GITHUB ACTIONS / CRON)     ")
    print("=" * 80)
    print(f" Empresas Procesadas Exitosas: {totales['empresas_procesadas']}/{len(empresas)}")
    print(f" Total Comparendos Activos   : {totales['total_comparendos']}")
    print(f" Valor Total Comparendos     : ${totales['total_valor']:,.2f} COP")
    print(f" Ahorro Potencial Disponible : ${totales['total_ahorro']:,.2f} COP")
    print(f" Total Errores               : {totales['errores']}")
    print("=" * 80)

if __name__ == "__main__":
    ejecutar_extraccion_lote(sin_interfaz=True)
