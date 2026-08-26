import sys
import re
import logging
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

def ejecutar_extraccion(criterio: str, tipo_consulta: str, sin_interfaz: bool = False):
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

    if not resultado.exitoso:
        print(f"\n[ERROR / RESPUESTA DE SIMIT]: {resultado.mensaje_error}")
        return resultado

    # 4. Guardar en Base de Datos (Supabase)
    print("\n[PASO 2] Persistiendo y actualizando datos en Supabase Cloud (comparendos_fscr)...")
    with obtener_sesion_bd() as sesion:
        repo = RepositorioBaseDatos(sesion)
        nuevos, actualizados = repo.guardar_comparendos(resultado.comparendos, resultado.criterio_busqueda)
        
        repo.registrar_log_extraccion(
            criterio=resultado.criterio_busqueda,
            tipo_consulta=resultado.tipo_consulta.value,
            encontrados=resultado.total_comparendos,
            nuevos=nuevos,
            actualizados=actualizados,
            exitoso=True
        )

    # 5. Imprimir resumen
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
        return resultado

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

    return resultado

def main():
    if len(sys.argv) > 1:
        param_limpio = re.sub(r'[^A-Z0-9]', '', sys.argv[1].upper())
        if param_limpio.isdigit():
            ejecutar_extraccion(param_limpio, "NIT")
        else:
            ejecutar_extraccion(param_limpio, "PLACA")
        return

    print("\n" + "=" * 80)
    print("      AGENTE DE EXTRACCIÓN Y VALIDACIÓN DE COMPARENDOS SIMIT (IA FLOTAS)     ")
    print("=" * 80)
    print("Seleccione la opción o digite directamente el NIT / Placa a consultar:")
    print(" 1. Consulta Masiva por NIT Corporativo")
    print(" 2. Consulta Puntual por Placa Vehicular")
    print(" 3. Salir")
    print("-" * 80)
    opcion = input("Digite 1, 2 o ingrese directamente la Placa / NIT: ").strip().upper()

    if not opcion or opcion == "3":
        print("Operación finalizada.")
        return

    if opcion == "1":
        nit = input("\nIngrese el NIT corporativo a consultar: ").strip()
        if nit:
            ejecutar_extraccion(nit, "NIT")
    elif opcion == "2":
        placa = input("\nIngrese la placa del vehículo a consultar: ").strip().upper()
        if placa:
            ejecutar_extraccion(placa, "PLACA")
    else:
        if opcion.isdigit():
            print(f"\n[DETECCIÓN AUTOMÁTICA]: Procesando consulta para el NIT {opcion}...")
            ejecutar_extraccion(opcion, "NIT")
        else:
            print(f"\n[DETECCIÓN AUTOMÁTICA]: Procesando consulta para la Placa {opcion}...")
            ejecutar_extraccion(opcion, "PLACA")

if __name__ == "__main__":
    main()
