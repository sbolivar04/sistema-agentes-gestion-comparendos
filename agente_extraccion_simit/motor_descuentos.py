from datetime import date, datetime
from configuracion import configuracion
from agente_extraccion_simit.modelos import EsquemaComparendo
from agente_extraccion_simit.festivos_colombia import sumar_dias_habiles

def calcular_descuentos(comparendo: EsquemaComparendo, fecha_evaluacion: date = None) -> EsquemaComparendo:
    """
    Aplica la lógica legal colombiana para calcular la vigencia de los descuentos
    del 50% y 25% según la ley de tránsito (Ley 769/2002 Art. 136 y Ley 1843/2017).
    
    :param comparendo: Objeto EsquemaComparendo a enriquecer.
    :param fecha_evaluacion: Fecha contra la cual evaluar vigencia (por defecto hoy).
    :return: EsquemaComparendo con fechas límite y valores calculados.
    """
    if fecha_evaluacion is None:
        fecha_evaluacion = date.today()

    # Fecha base para el cómputo: fecha de notificación (si existe) o fecha de infracción
    fecha_base_dt = comparendo.fecha_notificacion or comparendo.fecha_infraccion
    fecha_base = fecha_base_dt.date() if isinstance(fecha_base_dt, datetime) else fecha_base_dt

    # 1. Descuento del 50%: 11 días hábiles a partir de la fecha base
    fecha_limite_50 = sumar_dias_habiles(fecha_base, configuracion.DIAS_HABILES_DESCUENTO_50)
    valor_50 = round(comparendo.valor_total * (1.0 - configuracion.PORCENTAJE_DESCUENTO_1), 2)

    # 2. Descuento del 25%: 25 días hábiles a partir de la fecha base
    fecha_limite_25 = sumar_dias_habiles(fecha_base, configuracion.DIAS_HABILES_DESCUENTO_25)
    valor_25 = round(comparendo.valor_total * (1.0 - configuracion.PORCENTAJE_DESCUENTO_2), 2)

    # Asignar resultados al esquema
    comparendo.fecha_limite_descuento_50 = fecha_limite_50
    comparendo.valor_con_descuento_50 = valor_50
    comparendo.fecha_limite_descuento_25 = fecha_limite_25
    comparendo.valor_con_descuento_25 = valor_25

    # Evaluar si actualmente aplican a la fecha de consulta
    comparendo.aplica_descuento_50 = (fecha_evaluacion <= fecha_limite_50)
    comparendo.aplica_descuento_25 = (not comparendo.aplica_descuento_50) and (fecha_evaluacion <= fecha_limite_25)

    return comparendo

# Alias de compatibilidad
calculate_discounts = calcular_descuentos
