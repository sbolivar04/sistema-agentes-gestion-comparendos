"""
Módulo de utilidades para manejo de documentos y cálculo de dígitos de verificación (DV).
Implementa el algoritmo oficial de la DIAN (Módulo 11) para personas jurídicas en Colombia.
"""

import re
from typing import Tuple, Optional, List, Dict, Any


def calcular_digito_verificacion(nit: str) -> int:
    """
    Calcula el dígito de verificación (DV) para un NIT en Colombia
    según el procedimiento oficial de la DIAN (Módulo 11 con factores de ponderación).
    """
    nit_limpio = re.sub(r'\D', '', str(nit))
    if not nit_limpio:
        return 0

    pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
    
    suma = 0
    for indice, caracter in enumerate(reversed(nit_limpio)):
        if indice < len(pesos):
            suma += int(caracter) * pesos[indice]

    residuo = suma % 11
    if residuo in (0, 1):
        return residuo
    return 11 - residuo


def descomponer_nit(criterio: str) -> Tuple[str, int]:
    """
    Recibe un criterio de búsqueda (que puede ser un NIT con o sin guion, con o sin DV),
    y retorna una tupla (nit_base, digito_verificacion).
    
    Ejemplos:
      - '900160091' -> ('900160091', 0)
      - '900160091-0' -> ('900160091', 0)
      - '9005285051' -> ('900528505', 1)
      - '900.160.091-0' -> ('900160091', 0)
    """
    criterio_str = str(criterio).strip()
    
    # Caso 1: Viene explícitamente separado con guion (ej: 900160091-0)
    if "-" in criterio_str:
        partes = criterio_str.split("-")
        nit_base = re.sub(r'\D', '', partes[0])
        dv_str = re.sub(r'\D', '', partes[1])
        dv = int(dv_str[0]) if dv_str else calcular_digito_verificacion(nit_base)
        return nit_base, dv

    solo_digitos = re.sub(r'\D', '', criterio_str)
    
    # Caso 2: Viene con 10 dígitos continuos (ej: 9005285051)
    # Verificamos si los primeros 9 dígitos corresponden a un NIT cuyo DV coincide con el décimo dígito
    if len(solo_digitos) == 10:
        base_candidata = solo_digitos[:9]
        dv_esperado = calcular_digito_verificacion(base_candidata)
        if int(solo_digitos[9]) == dv_esperado:
            return base_candidata, dv_esperado
        return base_candidata, int(solo_digitos[9])

    # Caso 3: Viene como NIT base (usualmente 9 dígitos u 8 dígitos)
    dv_calculado = calcular_digito_verificacion(solo_digitos)
    return solo_digitos, dv_calculado


def obtener_variantes_busqueda(criterio: str, tipo_consulta: str = "NIT") -> List[Dict[str, Any]]:
    """
    Genera la lista ordenada de criterios a consultar en SIMIT.
    Para NITs, genera tanto la versión sin dígito de verificación como la versión con dígito continuo.
    Para placas o cédulas individuales, retorna únicamente el criterio original.
    """
    criterio_limpio = re.sub(r'[^A-Z0-9]', '', str(criterio).upper().strip())
    tipo_normalizado = str(tipo_consulta).strip().upper()

    # Si es una placa (ej: WEO146) o se solicita explícitamente PLACA
    if tipo_normalizado == "PLACA" or (len(criterio_limpio) <= 6 and not criterio_limpio.isdigit()):
        return [{
            "criterio": criterio_limpio,
            "criterio_base": criterio_limpio,
            "tipo_variante": "PLACA",
            "tiene_dv": False,
            "descripcion": f"Placa vehicular {criterio_limpio}"
        }]

    # Si es Cédula (personas naturales no usan DV)
    if tipo_normalizado in ("CÉDULA", "CEDULA", "CC"):
        return [{
            "criterio": criterio_limpio,
            "criterio_base": criterio_limpio,
            "tipo_variante": "CEDULA",
            "tiene_dv": False,
            "descripcion": f"Cédula de ciudadanía {criterio_limpio}"
        }]

    # Es NIT o número corporativo: Generar variantes con y sin DV
    nit_base, digito_verificacion = descomponer_nit(criterio)
    
    variante_sin_dv = f"{nit_base}"
    variante_con_dv = f"{nit_base}{digito_verificacion}"

    return [
        {
            "criterio": variante_sin_dv,
            "criterio_base": nit_base,
            "tipo_variante": "NIT_SIN_DV",
            "tiene_dv": False,
            "digito_verificacion": digito_verificacion,
            "descripcion": f"NIT sin dígito de verificación ({variante_sin_dv})"
        },
        {
            "criterio": variante_con_dv,
            "criterio_base": nit_base,
            "tipo_variante": "NIT_CON_DV",
            "tiene_dv": True,
            "digito_verificacion": digito_verificacion,
            "descripcion": f"NIT con dígito de verificación continuo ({variante_con_dv})"
        }
    ]
