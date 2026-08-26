import os
import sys
import logging
from pathlib import Path

DIRECTORIO_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DIRECTORIO_BASE))

from base_datos.conexion import inicializar_base_datos
from agente_extraccion_simit.extractor_principal import ejecutar_extraccion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ExtractorLote")

def obtener_nits_corporativos() -> list[dict]:
    """Extrae la lista de empresas y NITs desde datos/NIT.xlsx o lista por defecto."""
    nits = []
    archivo_excel = DIRECTORIO_BASE / "datos" / "NIT.xlsx"
    
    if archivo_excel.exists():
        try:
            import openpyxl
            wb = openpyxl.load_workbook(str(archivo_excel), data_only=True)
            ws = wb.active
            for fila in ws.iter_rows(values_only=True):
                # Detectar filas válidas con empresa y NIT
                if fila and len(fila) >= 3:
                    empresa = fila[1]
                    nit_val = fila[2]
                    if empresa and nit_val and str(nit_val).replace("-", "").isdigit():
                        nit_limpio = str(nit_val).replace("-", "").strip()
                        nits.append({"empresa": str(empresa).strip(), "nit": nit_limpio})
        except Exception as e:
            logger.warning(f"No se pudo leer datos/NIT.xlsx: {e}")

    # Fallback con NITs de la empresa si no se pudo leer el archivo
    if not nits:
        nits = [
            {"empresa": "FSCR Ingeniería S.A.S", "nit": "900160091"},
            {"empresa": "Servicios y Apoyo Total S.A.S.", "nit": "901818414"},
            {"empresa": "Maste Servicios Integrales S A S", "nit": "9005285051"}
        ]

    return nits

def ejecutar_extraccion_lote(sin_interfaz: bool = True):
    """Ejecuta la extracción secuencial para todas las empresas de la flota corporativa."""
    logger.info("=" * 80)
    logger.info(" INICIANDO EXTRACCIÓN AUTOMÁTICA EN LOTE PARA FLOTA CORPORATIVA")
    logger.info("=" * 80)

    # 1. Asegurar base de datos inicializada
    inicializar_base_datos()

    # 2. Cargar NITs
    empresas = obtener_nits_corporativos()
    logger.info(f"Se encontraron {len(empresas)} entidades para procesar en lote.")

    totales = {
        "empresas_procesadas": 0,
        "total_comparendos": 0,
        "total_valor": 0.0,
        "total_ahorro": 0.0,
        "errores": 0
    }

    for idx, item in enumerate(empresas, 1):
        empresa = item["empresa"]
        nit = item["nit"]
        logger.info(f"\n[{idx}/{len(empresas)}] Procesando {empresa} (NIT: {nit})...")

        try:
            resultado = ejecutar_extraccion(criterio=nit, tipo_consulta="NIT", sin_interfaz=sin_interfaz)
            if resultado and resultado.exitoso:
                totales["empresas_procesadas"] += 1
                totales["total_comparendos"] += resultado.total_comparendos
                totales["total_valor"] += resultado.total_valor_total
                totales["total_ahorro"] += (resultado.total_valor_total - resultado.total_valor_con_descuento_vigente)
            else:
                totales["errores"] += 1
        except Exception as e:
            logger.error(f"Error procesando NIT {nit} ({empresa}): {e}")
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
