"""
Alias de conveniencia para main_extractor.py.
Permite ejecutar el bot de extracción directamente con:
python main_extraccion.py
o con:
python main_extractor.py
"""
import sys
from agente_extraccion_simit.extractor_principal import main, ejecutar_extraccion

if __name__ == "__main__":
    main()
