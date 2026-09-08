import os
import sys
import uuid
from datetime import datetime
from typing import Optional
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

def ejecutar_extraccion_lote(
    sin_interfaz: bool = True,
    id_lote: Optional[str] = None,
    origen: str = "PROGRAMADO_MASIVO"
):
    """Ejecuta la extracción secuencial para todas las entidades activas de la flota corporativa con trazabilidad de lote."""
    if not id_lote:
        id_lote = f"lote_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    logger.info("=" * 80)
    logger.info(f" INICIANDO EXTRACCIÓN AUTOMÁTICA EN LOTE PARA FLOTA CORPORATIVA (ID Lote: {id_lote})")
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
    detalles_errores = []

    for idx, item in enumerate(empresas, 1):
        empresa = item["empresa"]
        criterio = item.get("criterio") or item.get("nit")
        tipo_doc = item.get("tipo_documento") or "NIT"
        logger.info(f"\n[{idx}/{len(empresas)}] Procesando {empresa} ({tipo_doc}: {criterio})...")

        try:
            resultado = ejecutar_extraccion(
                criterio=criterio,
                tipo_consulta=tipo_doc,
                sin_interfaz=sin_interfaz,
                id_lote=id_lote,
                origen=origen
            )
            if resultado and resultado.exitoso:
                totales["empresas_procesadas"] += 1
                totales["total_comparendos"] += resultado.total_comparendos
                totales["total_valor"] += resultado.total_valor_total
                totales["total_ahorro"] += (resultado.total_valor_total - resultado.total_valor_con_descuento_vigente)
            else:
                totales["errores"] += 1
                motivo = resultado.mensaje_error if resultado and resultado.mensaje_error else "SIMIT no respondió"
                detalles_errores.append(f"{empresa} ({criterio}): {motivo}")
        except Exception as e:
            logger.error(f"Error inesperado procesando {tipo_doc} {criterio} ({empresa}): {e}")
            totales["errores"] += 1
            detalles_errores.append(f"{empresa} ({criterio}): {str(e)}")
            try:
                with obtener_sesion_bd() as sesion:
                    repo = RepositorioBaseDatos(sesion)
                    repo.registrar_log_extraccion(
                        criterio=criterio,
                        tipo_consulta=tipo_doc,
                        encontrados=0,
                        nuevos=0,
                        actualizados=0,
                        exitoso=False,
                        error=str(e)[:500],
                        id_lote=id_lote,
                        origen=origen
                    )
            except Exception as e_bd:
                logger.error(f"No se pudo registrar log de error en Supabase: {e_bd}")

    # 3. Resumen final consolidado
    print("\n" + "=" * 80)
    print("      RESUMEN FINAL DE LA EXTRACCIÓN EN LOTE (GITHUB ACTIONS / CRON)     ")
    print("=" * 80)
    print(f" Empresas Procesadas Exitosas: {totales['empresas_procesadas']}/{len(empresas)}")
    print(f" Total Comparendos Activos   : {totales['total_comparendos']}")
    print(f" Valor Total Comparendos     : ${totales['total_valor']:,.2f} COP")
    print(f" Ahorro Potencial Disponible : ${totales['total_ahorro']:,.2f} COP")
    print(f" Total Errores               : {totales['errores']}")
    if detalles_errores:
        print("-" * 80)
        print(" DETALLE DE ENTIDADES CON ERROR:")
        for det in detalles_errores:
            print(f"  • {det}")
    print("=" * 80)

    if totales["errores"] > 0 and totales["empresas_procesadas"] == 0:
        logger.error("Fallo total en la extracción: Ninguna entidad de la flota pudo ser consultada en SIMIT.")
        sys.exit(1)

if __name__ == "__main__":
    ejecutar_extraccion_lote(sin_interfaz=True)
