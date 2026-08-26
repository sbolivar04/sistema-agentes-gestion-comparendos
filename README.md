# Automatización Inteligente para la Gestión y Seguimiento Preventivo de Infracciones de Tránsito en Flotas Corporativas

> **Trabajo de Grado - Maestría en Inteligencia Artificial**  
> **Autor:** Samir Enrique Bolívar Barrios  
> **Institución:** Universidad Simón Bolívar  

---

## 📌 Descripción del Proyecto

Sistema inteligente multiagente para la consulta, extracción y validación de comparendos de tránsito desde el portal oficial **SIMIT** asociados a flotas corporativas (por NIT o Placa). Integra:
1. **Agente Extractor & Validador (Playwright)**: Navegación automatizada sobre SIMIT en tiempo real.
2. **Motor de Reglas y Descuentos Legales**: Cálculo dinámico de vigencia de términos para descuentos del 50% y 25% (Ley 769/2002 y Ley 1843/2017) según calendario de días hábiles en Colombia.
3. **Repositorio Centralizado (Supabase Cloud)**: Persistencia en PostgreSQL bajo el esquema `comparendos_fscr`.
4. **Agente Orquestador con IA (Gemini / Text-to-SQL)**: Agente de razonamiento en lenguaje natural para análisis de flota *(Fase 3)*.
5. **Plataforma Web y Dashboard KPI**: Visualización de métricas estratégicas y chat con el agente *(Fase 4)*.

---

## 📂 Estructura Modular del Proyecto

```
Prototipo Sistema Agentes/
├── agente_extraccion_simit/      # [Módulo Agente 1: Extractor SIMIT]
│   ├── cliente.py                # Interfaz del cliente extractor
│   ├── cliente_navegador.py      # Automatización Playwright en vivo
│   ├── analizador.py             # Parseo de fechas, monedas y respuestas
│   ├── modelos.py                # Esquemas Pydantic de extracción
│   ├── motor_descuentos.py       # Cálculo de vigencia de descuentos (50% y 25%)
│   ├── festivos_colombia.py      # Calendario de festivos y días hábiles
│   └── extractor_principal.py    # Lógica de ejecución del extractor
│
├── base_datos/                   # [Módulo Central: Base de Datos Supabase]
│   ├── conexion.py               # Conexión resiliente a Supabase PostgreSQL
│   ├── modelos.py                # Modelos ORM (comparendos, logs, preferencias)
│   └── repositorio.py            # Guardado, upserts y resumen de flota
│
├── agente_orquestador/           # [Módulo Agente 2: IA & Text-to-SQL - Fase 3]
│
├── plataforma_web/               # [Módulo Interfaz Web & Dashboard - Fase 4]
│
├── datos/                        # [Insumos y matrices de datos]
│   ├── NIT.xlsx                  # Listado de NITs y vehículos
│   └── Tablas sql.xlsx           # Diccionario de tablas
│
├── documentacion/                # [Documentos académicos de la tesis]
│   └── PROPUESTA_TESIS.md        # Propuesta formal de grado
│
├── configuracion.py              # Parámetros y variables de entorno centrales
├── .env                          # Credenciales privadas de Supabase
├── .env.example                  # Plantilla de variables de entorno
├── .gitignore                    # Reglas de exclusión para Git
├── main_extractor.py             # Lanzador directo por consola
├── requirements.txt              # Dependencias de Python
└── README.md                     # Documentación técnica
```

---

## 🚀 Uso Rápido

```bash
# Modo interactivo
python main_extractor.py

# O consulta directa
python main_extractor.py 900123456
python main_extractor.py PAI65E
```
