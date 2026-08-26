from datetime import date, timedelta
import holidays

def obtener_festivos_colombia(anios: list[int] = None) -> set[date]:
    """Obtiene el conjunto de días festivos oficiales en Colombia para los años dados."""
    if anios is None:
        anio_actual = date.today().year
        anios = [anio_actual - 1, anio_actual, anio_actual + 1]
    
    festivos_co = holidays.Colombia(years=anios)
    return set(festivos_co.keys())

def sumar_dias_habiles(fecha_inicio: date, numero_dias: int) -> date:
    """
    Calcula una fecha futura sumando N días hábiles en Colombia a partir de fecha_inicio.
    Excluye sábados, domingos y festivos colombianos (Ley 769/2002 y Ley 1843/2017).
    """
    fecha_actual = fecha_inicio
    dias_sumados = 0
    
    anios = [fecha_inicio.year, fecha_inicio.year + 1]
    festivos = obtener_festivos_colombia(anios)

    while dias_sumados < numero_dias:
        fecha_actual += timedelta(days=1)
        # Lunes a Viernes: 0 a 4. Sábado: 5, Domingo: 6
        if fecha_actual.weekday() < 5 and fecha_actual not in festivos:
            dias_sumados += 1

    return fecha_actual
