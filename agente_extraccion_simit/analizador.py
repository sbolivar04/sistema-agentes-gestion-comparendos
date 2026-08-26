import re
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from agente_extraccion_simit.modelos import EsquemaComparendo

logger = logging.getLogger(__name__)

def parsear_moneda(val: Any) -> float:
    """Convierte texto de moneda ($ 633.232, $ 238.696 Interés $ 127.106) a float."""
    if isinstance(val, (int, float)):
        return float(val)
    if not val:
        return 0.0
    
    val_str = str(val).strip()
    
    coincidencias = re.findall(r'[\d\.]+', val_str)
    for coincidencia in coincidencias:
        limpio = coincidencia.replace(".", "")
        if limpio.isdigit() and len(limpio) >= 4:
            try:
                return float(limpio)
            except ValueError:
                continue

    limpio_str = re.sub(r"[^\d]", "", val_str)
    try:
        return float(limpio_str) if limpio_str else 0.0
    except ValueError:
        logger.warning(f"No se pudo convertir '{val}' a float. Retornando 0.0")
        return 0.0

def parsear_fecha(val: Any) -> Optional[datetime]:
    """Soporta múltiples formatos comunes de fecha/hora y extrae la fecha mediante regex."""
    if isinstance(val, datetime):
        return val
    if not val:
        return None
    
    val_str = str(val).strip()

    coincidencia_fecha = re.search(r'\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})(\s+\d{2}:\d{2}(:\d{2})?)?\b', val_str)
    if coincidencia_fecha:
        val_str = coincidencia_fecha.group(0).strip()

    formatos = [
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d"
    ]
    
    for fmt in formatos:
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            continue
            
    logger.debug(f"No se pudo parsear fecha '{val_str}' con formatos conocidos.")
    return None

# Alias de compatibilidad
parse_currency = parsear_moneda
parse_datetime = parsear_fecha
