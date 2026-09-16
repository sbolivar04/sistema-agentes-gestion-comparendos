"""
Módulo de utilidades para generación de reportes y exportación en Excel (.xlsx).
Cumple con las directrices exactas del usuario:
- Reporte único consolidado con columna 'Fotodetección' ('Electrónico' o 'Físico').
- Sin títulos superiores (inicia en Fila 1 con encabezados).
- Sin fila de total general.
- Nombre neutro 'Valor Base' para comparendos y multas.
- Fechas en formato DD/MM/YYYY con barras '/'.
- Anchos de columnas y alto de fila 1 calibrados con precisión.
"""

import io
from datetime import datetime, date
from typing import List, Any
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# Estilos Corporativos
COLOR_ENCABEZADO = "0F172A"       # Azul oscuro / Slate corporativo
COLOR_TEXTO_ENCABEZADO = "FFFFFF"
COLOR_FILA_PAR = "F8FAFC"

FUENTE_ENCABEZADO = Font(name="Segoe UI", size=10, bold=True, color=COLOR_TEXTO_ENCABEZADO)
FUENTE_DATOS = Font(name="Segoe UI", size=9)

FILL_ENCABEZADO = PatternFill(start_color=COLOR_ENCABEZADO, end_color=COLOR_ENCABEZADO, fill_type="solid")
FILL_PAR = PatternFill(start_color=COLOR_FILA_PAR, end_color=COLOR_FILA_PAR, fill_type="solid")

BORDE_FINO = Border(
    left=Side(style="thin", color="E2E8F0"),
    right=Side(style="thin", color="E2E8F0"),
    top=Side(style="thin", color="E2E8F0"),
    bottom=Side(style="thin", color="E2E8F0")
)

FORMATO_MONEDA = '"$"#,##0'
FORMATO_FECHA = "dd/mm/yyyy"


def _formatear_fecha(dt) -> str:
    """Formatea cualquier fecha a cadena DD/MM/YYYY preservando textos jurídicos de estado."""
    if not dt:
        return "N/A"
    if isinstance(dt, (datetime, date)):
        return dt.strftime("%d/%m/%Y")
    if isinstance(dt, str):
        texto = dt.strip()
        # Si es un texto de estado sin dígitos (ej: "Vencido", "Pendiente")
        if not any(char.isdigit() for char in texto):
            return texto
        solo_fecha = texto.split("T")[0].split(" ")[0]
        if "-" in solo_fecha:
            partes = solo_fecha.split("-")
            if len(partes) == 3:
                # Si el año viene al principio: YYYY-MM-DD -> DD/MM/YYYY
                if len(partes[0]) == 4:
                    return f"{partes[2].zfill(2)}/{partes[1].zfill(2)}/{partes[0]}"
                # Si el año viene al final: DD-MM-YYYY -> DD/MM/YYYY
                if len(partes[2]) == 4:
                    return f"{partes[0].zfill(2)}/{partes[1].zfill(2)}/{partes[2]}"
        return texto.replace("-", "/")
    return str(dt)


def generar_excel_resumen(comparendos_serializados: List[dict]) -> io.BytesIO:
    """
    Genera el archivo Excel (.xlsx) ejecutivo y operativo único de comparendos.
    Incluye la columna 'Fotodetección' ('Electrónico' o 'Físico') y nombre neutro 'Valor Base'.
    Inicia en Fila 1 y prescinde de fila de total general.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Comparendos SIMIT"
    ws.views.sheetView[0].showGridLines = True

    # 1. Encabezados de Columnas (Fila 1)
    encabezados = [
        "Placa",
        "No. Comparendo",
        "No. Resolución",
        "Tipo Registro",
        "Fotodetección",
        "Infracción",
        "Descripción Infracción",
        "Secretaría",
        "Fecha Infracción",
        "Fecha Notificación",
        "Valor Base",
        "Intereses Mora",
        "Valor Total",
        "Beneficio Ley",
        "Límite Descuento",
        "Total a Pagar",
        "Ahorro",
        "Estado SIMIT"
    ]

    fila_encabezado = 1
    for col_idx, texto in enumerate(encabezados, start=1):
        celda = ws.cell(row=fila_encabezado, column=col_idx, value=texto)
        celda.font = FUENTE_ENCABEZADO
        celda.fill = FILL_ENCABEZADO
        celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
        celda.border = BORDE_FINO

    ws.row_dimensions[fila_encabezado].height = 20.0

    # 2. Filas de Datos (Inician en Fila 2)
    fila_actual = 2
    for idx, c in enumerate(comparendos_serializados):
        val_nominal = float(c.get("valor_nominal") or 0)
        intereses = float(c.get("intereses") or 0)
        val_total = float(c.get("valor_total") or 0)
        val_pagar = float(c.get("valor_a_pagar") or val_total)
        ahorro = float(c.get("ahorro_disponible") or 0)

        tipo_fotodeteccion = "Electrónico" if c.get("es_fotodeteccion") else "Físico"

        fila_datos = [
            c.get("placa") or "N/A",
            c.get("numero_comparendo") or "N/A",
            c.get("numero_resolucion") or "N/A",
            c.get("tipo_registro") or "Comparendo",
            tipo_fotodeteccion,
            c.get("codigo_infraccion") or "",
            c.get("descripcion_infraccion") or "",
            c.get("secretaria") or "",
            _formatear_fecha(c.get("fecha_infraccion")),
            _formatear_fecha(c.get("fecha_notificacion")),
            val_nominal,
            intereses,
            val_total,
            c.get("etiqueta_descuento") or "Sin Descuento",
            _formatear_fecha(c.get("fecha_limite_descuento")),
            val_pagar,
            ahorro,
            c.get("estado_simit") or "Activo"
        ]

        usar_par = (idx % 2 == 1)
        for col_idx, valor in enumerate(fila_datos, start=1):
            celda = ws.cell(row=fila_actual, column=col_idx, value=valor)
            celda.font = FUENTE_DATOS
            celda.border = BORDE_FINO
            if usar_par:
                celda.fill = FILL_PAR

            # Formatos de moneda y alineaciones
            if col_idx in (11, 12, 13, 16, 17):  # Monedas: Valor Base, Intereses, Total, Pagar, Ahorro
                celda.number_format = FORMATO_MONEDA
                celda.alignment = Alignment(horizontal="right", vertical="center")
            elif col_idx in (1, 2, 3, 4, 5, 6, 9, 10, 14, 15, 18):  # Centradas
                celda.alignment = Alignment(horizontal="center", vertical="center")
            else:  # Textos largos a la izquierda: Descripción Infracción (7), Secretaría (8)
                celda.alignment = Alignment(horizontal="left", vertical="center")

        ws.row_dimensions[fila_actual].height = 20.0
        fila_actual += 1

    # 3. Anchos de Columnas Calibrados
    anchos_columnas = {
        "A": 10.0,       # Placa
        "B": 21.0,       # No. Comparendo
        "C": 19.1,       # No. Resolución
        "D": 14.0,       # Tipo Registro
        "E": 14.5,       # Fotodetección (Electrónico / Físico)
        "F": 10.55,      # Infracción
        "G": 33.0,       # Descripción Infracción
        "H": 20.2,       # Secretaría
        "I": 15.4,       # Fecha Infracción
        "J": 20.0,       # Fecha Notificación
        "K": 12.75,      # Valor Base
        "L": 14.85,      # Intereses Mora
        "M": 14.0,       # Valor Total
        "N": 15.3,       # Beneficio Ley
        "O": 18.0,       # Límite Descuento
        "P": 13.2,       # Total a Pagar
        "Q": 10.0,       # Ahorro
        "R": 13.0        # Estado SIMIT
    }
    for col_letter, ancho in anchos_columnas.items():
        ws.column_dimensions[col_letter].width = ancho

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
