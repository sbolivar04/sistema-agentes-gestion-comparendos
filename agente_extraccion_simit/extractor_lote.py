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
from agente_extraccion_simit.cliente import ClienteSimit
from agente_extraccion_simit.extractor_principal import guardar_resultado_extraccion

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("ExtractorLote")

def obtener_entidades_activas(criterios_filtro: Optional[list[str]] = None) -> list[dict]:
    """Obtiene la lista de entidades y documentos activos desde la base de datos Supabase, opcionalmente filtrada."""
    entidades = []
    criterios_set = {c.strip().upper() for c in criterios_filtro if c and c.strip()} if criterios_filtro else None

    try:
        with obtener_sesion_bd() as sesion:
            repo = RepositorioBaseDatos(sesion)
            registros = repo.obtener_entidades_consulta(solo_activas=True)
            for r in registros:
                crit_limpio = str(r.criterio_busqueda).strip().upper()
                if criterios_set is not None and crit_limpio not in criterios_set:
                    continue
                entidades.append({
                    "id": r.id,
                    "empresa": r.nombre_entidad,
                    "criterio": r.criterio_busqueda,
                    "tipo_documento": r.tipo_documento or "NIT"
                })
    except Exception as e:
        logger.error(f"Error al consultar entidades activas en Supabase: {e}")

    # Si se especificaron criterios de filtro pero alguno no estaba en la BD, agregarlo directamente
    if criterios_set:
        criterios_encontrados = {str(e["criterio"]).strip().upper() for e in entidades}
        for c in criterios_set:
            if c not in criterios_encontrados:
                es_num = c.isdigit()
                entidades.append({
                    "id": None,
                    "empresa": f"Entidad {c}",
                    "criterio": c,
                    "tipo_documento": "NIT" if es_num else "PLACA"
                })

    # Fallback de seguridad si la base de datos estuviera vacía y no hay filtro
    if not entidades and not criterios_filtro:
        entidades = [
            {"id": 1, "empresa": "FSCR Ingeniería S.A.S", "criterio": "900160091", "tipo_documento": "NIT"},
            {"id": 2, "empresa": "Servicios y Apoyo Total S.A.S.", "criterio": "901818414", "tipo_documento": "NIT"},
            {"id": 3, "empresa": "Maste Servicios Integrales S A S", "criterio": "9005285051", "tipo_documento": "NIT"}
        ]

    return entidades

def ejecutar_extraccion_lote(
    sin_interfaz: bool = True,
    id_lote: Optional[str] = None,
    origen: str = "PROGRAMADO_MASIVO",
    usuario: str = "Sistema",
    criterios_filtro: Optional[list[str]] = None
):
    """
    Ejecuta la extracción secuencial para todas las entidades activas de la flota corporativa
    (o un subconjunto específico de criterios para reintento de fallos)
    en UNA SOLA SESIÓN CONTINUA de navegador, reutilizando la caja superior de búsqueda de SIMIT.
    """
    if not id_lote:
        id_lote = f"lote_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    usuario_final = (usuario or "Sistema").strip()

    logger.info("=" * 80)
    if criterios_filtro:
        logger.info(f" REINTENTANDO EXTRACCIÓN MASIVA CONTINUA PARA {len(criterios_filtro)} ENTIDADES (ID Lote: {id_lote})")
    else:
        logger.info(f" INICIANDO EXTRACCIÓN MASIVA CONTINUA PARA FLOTA CORPORATIVA (ID Lote: {id_lote})")
    logger.info(f" Origen: {origen} | Usuario ejecutor: {usuario_final}")
    logger.info(f" Modo de navegación: {'Segundo plano (Headless)' if sin_interfaz else 'Visual en pantalla'}")
    logger.info("=" * 80)

    # 1. Asegurar base de datos inicializada
    inicializar_base_datos()

    # 2. Cargar entidades desde Supabase
    empresas = obtener_entidades_activas(criterios_filtro=criterios_filtro)
    logger.info(f"Se encontraron {len(empresas)} entidades para procesar en esta sesión.")

    if not empresas:
        logger.warning("No hay entidades activas configuradas para consultar.")
        return

    totales = {
        "empresas_procesadas": 0,
        "total_comparendos": 0,
        "total_valor": 0.0,
        "total_ahorro": 0.0,
        "errores": 0
    }
    detalles_errores = []

    # 3. Callback para persistir y reportar cada entidad inmediatamente al completar su búsqueda
    def al_procesar_entidad(item: dict, resultado):
        empresa = item.get("empresa") or item.get("criterio")
        criterio = item.get("criterio") or item.get("nit") or item.get("placa")
        tipo_doc = item.get("tipo_documento") or ("NIT" if str(criterio).isdigit() else "PLACA")

        try:
            if resultado and resultado.exitoso:
                totales["empresas_procesadas"] += 1
                totales["total_comparendos"] += resultado.total_comparendos
                totales["total_valor"] += resultado.total_valor_total
                totales["total_ahorro"] += (resultado.total_valor_total - resultado.total_valor_con_descuento_vigente)
                guardar_resultado_extraccion(
                    resultado=resultado,
                    criterio=criterio,
                    tipo_consulta=tipo_doc,
                    id_lote=id_lote,
                    origen=origen,
                    usuario=usuario_final
                )
            else:
                totales["errores"] += 1
                motivo = resultado.mensaje_error if resultado and resultado.mensaje_error else "SIMIT no respondió"
                detalles_errores.append(f"{empresa} ({criterio}): {motivo}")
                guardar_resultado_extraccion(
                    resultado=resultado,
                    criterio=criterio,
                    tipo_consulta=tipo_doc,
                    id_lote=id_lote,
                    origen=origen,
                    usuario=usuario_final
                )
        except Exception as e_persistencia:
            logger.error(f"Error al persistir resultado para {criterio} ({empresa}): {e_persistencia}")

    # 4. Iniciar cliente de navegación y ejecutar todas las entidades en una sola carga
    cliente = ClienteSimit(sin_interfaz=sin_interfaz)
    try:
        cliente.consultar_lote(empresas, callback_procesamiento=al_procesar_entidad)
    except Exception as e_general:
        logger.error(f"Error crítico durante la sesión continua de extracción en lote: {e_general}")
        for item in empresas:
            criterio = item.get("criterio") or item.get("nit")
            empresa = item.get("empresa") or criterio
            tipo_doc = item.get("tipo_documento") or "NIT"
            if not any(criterio in det for det in detalles_errores) and totales["empresas_procesadas"] == 0:
                detalles_errores.append(f"{empresa} ({criterio}): {str(e_general)}")
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
                            error=str(e_general)[:500],
                            id_lote=id_lote,
                            origen=origen,
                            usuario=usuario_final
                        )
                except Exception:
                    pass

    # 5. Resumen final consolidado
    print("\n" + "=" * 80)
    print("      RESUMEN FINAL DE LA EXTRACCIÓN EN LOTE CONTINUA (OPTIMIZADA)       ")
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

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Extracción en lote continua para flota corporativa")
    parser.add_argument("--visual", action="store_true", help="Navegación visual con interfaz gráfica")
    parser.add_argument("--con-interfaz", action="store_true", help="Navegación visual con interfaz gráfica")
    parser.add_argument("--origen", type=str, default="PROGRAMADO_MASIVO", help="Origen: MANUAL_MASIVO, PROGRAMADO_MASIVO, etc.")
    parser.add_argument("--usuario", type=str, default="Sistema", help="Nombre o correo del usuario ejecutor")
    parser.add_argument("--criterios", type=str, default=None, help="Lista de criterios o NITs a reintentar separados por coma")
    args, _ = parser.parse_known_args()

    criterios_filtro = [c.strip() for c in args.criterios.split(",") if c.strip()] if args.criterios else None

    sin_interfaz = not (args.visual or args.con_interfaz)
    ejecutar_extraccion_lote(
        sin_interfaz=sin_interfaz,
        origen=args.origen,
        usuario=args.usuario,
        criterios_filtro=criterios_filtro
    )

if __name__ == "__main__":
    main()
