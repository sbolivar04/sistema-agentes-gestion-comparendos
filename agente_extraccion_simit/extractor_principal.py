import sys
import re
import logging
from typing import Optional
from pathlib import Path

DIRECTORIO_BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DIRECTORIO_BASE))

from base_datos.conexion import inicializar_base_datos, obtener_sesion_bd
from agente_extraccion_simit.cliente import ClienteSimit
from base_datos.repositorio import RepositorioBaseDatos

# Configurar logging visible en consola
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ExtractorPrincipal")

def ejecutar_extraccion(
    criterio: str,
    tipo_consulta: str = "NIT",
    sin_interfaz: bool = False,
    id_lote: Optional[str] = None,
    origen: Optional[str] = None
):
    """Inicializa la BD, ejecuta la extracción en SIMIT y persiste los resultados en Supabase."""
    print("\n" + "=" * 80)
    print("      AGENTE DE EXTRACCIÓN Y VALIDACIÓN DE COMPARENDOS SIMIT (IA FLOTAS)     ")
    print("=" * 80)
    if not sin_interfaz:
        print(" *** INICIANDO EXTRACCIÓN VISUAL EN TIEMPO REAL ***")
        print(" >>> Se abrirá una ventana de Chrome/Edge en tu pantalla para navegar en SIMIT.")
    else:
        print(" *** INICIANDO EXTRACCIÓN EN SEGUNDO PLANO (HEADLESS) ***")
    print("=" * 80)

    # 1. Inicializar esquema de Base de Datos en Supabase
    inicializar_base_datos()

    # 2. Instanciar Cliente Extractor
    cliente = ClienteSimit(sin_interfaz=sin_interfaz)

    # 3. Ejecutar extracción
    if tipo_consulta == "NIT":
        print(f"\n[PASO 1] Consultando SIMIT en vivo para el NIT: {criterio}")
        resultado = cliente.consultar_por_nit(criterio)
    else:
        print(f"\n[PASO 1] Consultando SIMIT en vivo para la Placa: {criterio}")
        resultado = cliente.consultar_por_placa(criterio)

    # 4. Guardar en Base de Datos y reportar
    guardar_resultado_extraccion(
        resultado=resultado,
        criterio=criterio,
        tipo_consulta=tipo_consulta,
        id_lote=id_lote,
        origen=origen
    )
    return resultado

def guardar_resultado_extraccion(
    resultado,
    criterio: str,
    tipo_consulta: str = "NIT",
    id_lote: Optional[str] = None,
    origen: Optional[str] = None
) -> tuple[int, int]:
    """Persiste los resultados de la consulta en Supabase, registra auditoría y presenta el reporte en consola."""
    if not resultado.exitoso:
        print(f"\n[ERROR / RESPUESTA DE SIMIT]: {resultado.mensaje_error}")
        try:
            with obtener_sesion_bd() as sesion:
                repo = RepositorioBaseDatos(sesion)
                repo.registrar_log_extraccion(
                    criterio=resultado.criterio_busqueda if hasattr(resultado, 'criterio_busqueda') else criterio,
                    tipo_consulta=resultado.tipo_consulta.value if hasattr(resultado, 'tipo_consulta') and hasattr(resultado.tipo_consulta, 'value') else tipo_consulta,
                    encontrados=0,
                    nuevos=0,
                    actualizados=0,
                    exitoso=False,
                    error=resultado.mensaje_error[:500] if resultado.mensaje_error else "Error de conexión o portal no disponible en SIMIT",
                    id_lote=id_lote,
                    origen=origen or ("PROGRAMADO_MASIVO" if id_lote else "MANUAL_INDIVIDUAL")
                )
        except Exception as e_log:
            print(f"[AUDITORÍA] Advertencia: No se pudo registrar log de fallo en Supabase: {e_log}")
        return 0, 0

    if resultado.mensaje_error and "Requiere configurar" in resultado.mensaje_error:
        print(f"\n[AVISO DEL AGENTE]: El documento {criterio} requiere que se defina si es NIT o Cédula en la plataforma web. Se generó la alerta para su configuración.")
        return 0, 0

    # Guardar en Base de Datos (Supabase)
    print(f"\n[PERSISTENCIA] Guardando datos en Supabase Cloud (comparendos_fscr) para {resultado.criterio_busqueda}...")
    nuevos = 0
    actualizados = 0
    with obtener_sesion_bd() as sesion:
        repo = RepositorioBaseDatos(sesion)
        nuevos, actualizados = repo.guardar_comparendos(resultado.comparendos, resultado.criterio_busqueda)
        
        repo.registrar_log_extraccion(
            criterio=resultado.criterio_busqueda,
            tipo_consulta=resultado.tipo_consulta.value if hasattr(resultado.tipo_consulta, 'value') else str(resultado.tipo_consulta),
            encontrados=resultado.total_comparendos,
            nuevos=nuevos,
            actualizados=actualizados,
            exitoso=True,
            id_lote=id_lote,
            origen=origen or ("PROGRAMADO_MASIVO" if id_lote else "MANUAL_INDIVIDUAL")
        )

    # Imprimir resumen
    print("\n" + "=" * 80)
    print(f"       RESULTADOS DE LA EXTRACCIÓN EN VIVO ({tipo_consulta}: {criterio})       ")
    print("=" * 80)
    print(f" Registros Nuevos Insertados : {nuevos}")
    print(f" Registros Actualizados      : {actualizados}")
    print(f" Total Comparendos Encontrados: {resultado.total_comparendos}")
    print(f" Valor Total Comparendos      : ${resultado.total_valor_total:,.2f} COP")
    print(f" Valor Total con Descuentos   : ${resultado.total_valor_con_descuento_vigente:,.2f} COP")
    ahorro = resultado.total_valor_total - resultado.total_valor_con_descuento_vigente
    print(f" AHORRO POTENCIAL DISPONIBLE  : ${ahorro:,.2f} COP")
    print("=" * 80)

    if resultado.total_comparendos == 0:
        print("\n [SIMIT CONFIRMA]: No existen comparendos registrados para este criterio en el portal oficial.")
        return nuevos, actualizados

    print("\n>>> DETALLE DE COMPARENDOS EXTRAÍDOS REALES:")
    for idx, c in enumerate(resultado.comparendos, 1):
        res_str = f" | No. Res: {c.numero_resolucion}" if c.numero_resolucion else ""
        tipo_str = c.tipo_registro.upper() if c.tipo_registro else 'COMPARENDO'
        print(f"\n [{idx}] {tipo_str} #: {c.numero_comparendo}{res_str} | Placa: {c.placa}")
        print(f"     Infracción : {c.codigo_infraccion} - {c.descripcion_infraccion}")
        print(f"     Secretaría : {c.secretaria}")
        if c.direccion:
            print(f"     Dirección  : {c.direccion}")
        if c.fuente_comparendo:
            print(f"     Fuente     : {c.fuente_comparendo}")
        print(f"     Fecha Inf. : {c.fecha_infraccion.strftime('%Y-%m-%d %H:%M:%S')}")
        if c.fecha_notificacion:
            print(f"     Fecha Notif: {c.fecha_notificacion.strftime('%Y-%m-%d')}")
        else:
            print(f"     Fecha Notif: No aplica/No registra")
        if c.tipo_registro == "Multa" and c.fecha_resolucion:
            print(f"      Resolución: {c.fecha_resolucion.strftime('%d/%m/%Y')}")
        print(f"      Valor: ${c.valor:,.0f} | Intereses: ${c.intereses:,.0f} | Total: ${c.valor_total:,.0f}")
        if c.aplica_descuento_50:
            print(f"     [¡VIGENTE DESCUENTO 50%!] Paga solo: ${c.valor_con_descuento_50:,.2f} COP (Límite: {c.fecha_limite_descuento_50})")
        elif c.aplica_descuento_25:
            print(f"     [VIGENTE DESCUENTO 25%] Paga solo: ${c.valor_con_descuento_25:,.2f} COP (Límite: {c.fecha_limite_descuento_25})")
        else:
            print(f"     [DESCUENTO VENCIDO] Debe pagar el 100%: ${c.valor_total:,.2f} COP")

    return nuevos, actualizados

def main():
    sin_interfaz = "--sin-interfaz" in sys.argv or "--headless" in sys.argv
    args_limpios = [a for a in sys.argv[1:] if a not in ["--sin-interfaz", "--headless"]]

    if len(args_limpios) > 0:
        param_limpio = re.sub(r'[^A-Z0-9]', '', args_limpios[0].upper())
        if param_limpio.isdigit():
            ejecutar_extraccion(param_limpio, "NIT", sin_interfaz=sin_interfaz)
        else:
            ejecutar_extraccion(param_limpio, "PLACA", sin_interfaz=sin_interfaz)
        return

    print("\n" + "=" * 80)
    print("      AGENTE DE EXTRACCIÓN Y VALIDACIÓN DE COMPARENDOS SIMIT (IA FLOTAS)     ")
    print("=" * 80)
    print("Seleccione la opción o digite directamente el NIT / Placa a consultar:")
    print(" 1. Sincronizar Flota Completa (Sesión continua optimizada)")
    print(" 2. Consulta Individual por NIT Corporativo (Visual)")
    print(" 3. Consulta Puntual por Placa Vehicular (Visual)")
    print(" 4. Consulta en Segundo Plano / Headless (Sin ventana gráfica)")
    print(" 5. Salir")
    print("-" * 80)
    opcion = input("Digite 1, 2, 3, 4 o ingrese directamente la Placa / NIT: ").strip().upper()

    if not opcion or opcion in ["5", "SALIR", "EXIT"]:
        print("Operación finalizada.")
        return

    if opcion == "1":
        from agente_extraccion_simit.extractor_lote import ejecutar_extraccion_lote
        print("\n[INICIANDO]: Sincronización continua de la flota corporativa en vivo...")
        ejecutar_extraccion_lote(sin_interfaz=False, origen="MANUAL_MASIVO")
    elif opcion == "2":
        nit = input("\nIngrese el NIT corporativo a consultar: ").strip()
        if nit:
            ejecutar_extraccion(nit, "NIT", sin_interfaz=False)
    elif opcion == "3":
        placa = input("\nIngrese la placa del vehículo a consultar: ").strip().upper()
        if placa:
            ejecutar_extraccion(placa, "PLACA", sin_interfaz=False)
    elif opcion == "4":
        criterio = input("\nIngrese el NIT o Placa a consultar en segundo plano: ").strip()
        if criterio:
            param_limpio = re.sub(r'[^A-Z0-9]', '', criterio.upper())
            tipo = "NIT" if param_limpio.isdigit() else "PLACA"
            ejecutar_extraccion(param_limpio, tipo, sin_interfaz=True)
    else:
        if opcion.isdigit():
            print(f"\n[DETECCIÓN AUTOMÁTICA]: Procesando consulta para el NIT {opcion}...")
            ejecutar_extraccion(opcion, "NIT", sin_interfaz=False)
        else:
            print(f"\n[DETECCIÓN AUTOMÁTICA]: Procesando consulta para la Placa {opcion}...")
            ejecutar_extraccion(opcion, "PLACA", sin_interfaz=False)

if __name__ == "__main__":
    main()

