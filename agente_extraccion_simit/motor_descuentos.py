from datetime import date, datetime
from configuracion import configuracion
from agente_extraccion_simit.modelos import EsquemaComparendo
from agente_extraccion_simit.festivos_colombia import sumar_dias_habiles

def calcular_descuentos(comparendo: EsquemaComparendo, fecha_evaluacion: date = None) -> EsquemaComparendo:
    """
    Aplica la lógica legal colombiana para calcular la vigencia de los descuentos
    del 50% y 25% según la ley de tránsito (Ley 769/2002 Art. 136 y Ley 1843/2017 Art. 8).
    
    Reglas Legales:
    1. MULTAS / RESOLUCIONES SANCIONATORIAS / INTERESES:
       Si el registro es una Multa, cuenta con resolución sancionatoria o tiene intereses de mora,
       los términos legales para comparecer expiraron. NO aplica ningún descuento (50% ni 25%),
       debe pagar el 100% de la tarifa plena + intereses.
    2. COMPARENDOS FÍSICOS (En vía con agente):
       La notificación se surte de manera personal e inmediata en el acto de la infracción (Art. 135 Ley 769).
       Si fecha_notificacion es None, se asigna fecha_infraccion. Términos: 5 días hábiles (50%) y 20 días hábiles (25%).
    3. FOTODETECCIONES SIN NOTIFICACIÓN CONFIRMADA:
       Solo para fotodetecciones (es_fotodeteccion=True) que no sean multas ni tengan resolución.
       Los 11 días hábiles quedan pendientes hasta la notificación formal por correo.
    """
    if fecha_evaluacion is None:
        fecha_evaluacion = date.today()

    tipo_str = str(getattr(comparendo, "tipo_registro", "") or "").strip().lower()
    tiene_resolucion = bool(getattr(comparendo, "fecha_resolucion", None))
    intereses_val = float(getattr(comparendo, "intereses", 0.0) or 0.0)
    es_multa = (tipo_str == "multa") or tiene_resolucion or (intereses_val > 0)

    # REGLA 1: Si es Multa, tiene Resolución o tiene intereses de mora -> CERO descuento
    if es_multa:
        comparendo.aplica_descuento_50 = False
        comparendo.aplica_descuento_25 = False
        comparendo.fecha_limite_descuento_50 = None
        comparendo.fecha_limite_descuento_25 = None
        comparendo.valor_con_descuento_50 = comparendo.valor_total
        comparendo.valor_con_descuento_25 = comparendo.valor_total
        return comparendo

    es_foto = bool(getattr(comparendo, "es_fotodeteccion", False))

    # REGLA 2: Comparendo físico sin fecha de notificación -> Notificado en vía en fecha de infracción
    if not es_foto and not comparendo.fecha_notificacion and comparendo.fecha_infraccion:
        comparendo.fecha_notificacion = comparendo.fecha_infraccion

    valor_50 = round(comparendo.valor_total * (1.0 - configuracion.PORCENTAJE_DESCUENTO_1), 2)
    valor_25 = round(comparendo.valor_total * (1.0 - configuracion.PORCENTAJE_DESCUENTO_2), 2)

    # REGLA 3: Fotodetección sin notificar (términos no iniciados)
    if not comparendo.fecha_notificacion:
        comparendo.fecha_limite_descuento_50 = None
        comparendo.fecha_limite_descuento_25 = None
        comparendo.aplica_descuento_50 = True
        comparendo.aplica_descuento_25 = False
        comparendo.valor_con_descuento_50 = valor_50
        comparendo.valor_con_descuento_25 = valor_25
        return comparendo

    # REGLA 4: Comparendo con fecha de notificación (físico o fotomulta)
    fecha_base_dt = comparendo.fecha_notificacion
    fecha_base = fecha_base_dt.date() if isinstance(fecha_base_dt, datetime) else fecha_base_dt

    dias_50 = 11 if es_foto else 5
    dias_25 = 26 if es_foto else 20

    fecha_limite_50 = sumar_dias_habiles(fecha_base, dias_50)
    fecha_limite_25 = sumar_dias_habiles(fecha_base, dias_25)

    comparendo.fecha_limite_descuento_50 = fecha_limite_50
    comparendo.fecha_limite_descuento_25 = fecha_limite_25

    comparendo.aplica_descuento_50 = (fecha_evaluacion <= fecha_limite_50)
    comparendo.aplica_descuento_25 = (not comparendo.aplica_descuento_50) and (fecha_evaluacion <= fecha_limite_25)

    comparendo.valor_con_descuento_50 = valor_50 if comparendo.aplica_descuento_50 else comparendo.valor_total
    comparendo.valor_con_descuento_25 = valor_25 if comparendo.aplica_descuento_25 else comparendo.valor_total

    return comparendo

# Alias de compatibilidad
calculate_discounts = calcular_descuentos
