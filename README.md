# Automatización Inteligente para la Gestión y Seguimiento Preventivo de Infracciones de Tránsito en Flotas Corporativas

> **Trabajo de Grado - Maestría en Inteligencia Artificial**  
> **Autor:** Samir Enrique Bolívar Barrios  
> **Institución:** Universidad Simón Bolívar  

---

## 📌 Descripción del Proyecto

Sistema inteligente multiagente para la consulta, extracción, validación legal y análisis de comparendos de tránsito desde el portal oficial **SIMIT** asociados a flotas corporativas (por NIT o Placa).

### 🤖 Arquitectura Multiagente:
1. **Agente Extractor & Validador (Playwright)**: Navegación automatizada sobre SIMIT en tiempo real y ejecución programada en la nube con **GitHub Actions** y sincronización vía **Supabase `pg_cron`**.
2. **Motor de Reglas y Descuentos Legales**: Cálculo dinámico de vigencia de términos para descuentos del 50% y 25% (Ley 769/2002 y Ley 1843/2017) según calendario de días hábiles y festivos en Colombia.
3. **Repositorio Centralizado (Supabase Cloud)**: Persistencia en PostgreSQL bajo el esquema `comparendos_fscr`.
4. **Agente Orquestador Inteligente (Google Gemini + Text-to-SQL + Tools)**: Agente de razonamiento en lenguaje natural para análisis de flota, detección de riesgos de vencimiento, prescripción y consultas analíticas.
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
│   ├── extractor_lote.py         # Procesamiento masivo de toda la flota
│   └── extractor_principal.py    # Lógica de ejecución del extractor
│
├── agente_orquestador/           # [Módulo Agente 2: IA & Text-to-SQL]
│   ├── motor_gemini.py           # Cliente Gemini con Function Calling nativo
│   ├── herramientas.py           # Herramientas especializadas (Tools)
│   ├── prompts_sistema.py        # System instructions y marco legal Colombia
│   ├── modelos.py                # Esquemas de mensajes y respuestas
│   └── orquestador_principal.py  # CLI conversacional interactivo
│
├── base_datos/                   # [Módulo Central: Base de Datos Supabase]
│   ├── conexion.py               # Conexión resiliente a Supabase PostgreSQL
│   ├── modelos.py                # Modelos ORM (comparendos, logs, preferencias)
│   └── repositorio.py            # Guardado, upserts y resumen de flota
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
├── .github/workflows/            # [Automatización CI/CD]
│   └── extraccion_simit.yml      # Workflow de extracción en la nube
│
├── configuracion.py              # Parámetros y variables de entorno centrales (.env)
├── main_extractor.py             # Lanzador directo del extractor
├── requirements.txt              # Dependencias de Python
└── README.md                     # Documentación técnica
```

---

## 🚀 Modos de Uso

### 1. Plataforma Web Corporativa & Dashboard Interactivo (React + FastAPI):
```bash
python main_web.py
```
- **URL de la Aplicación:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Documentación Swagger API:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Funcionalidades:**
  * Login corporativo con logo de **FSCR Ingeniería S.A.S.** y Supabase Auth.
  * Selector de tema: **Blanco (Predeterminado)** y **Modo Oscuro**.
  * Semáforo de alertas de vencimiento de descuentos (8 a 5 días amarillo, $\le 4$ días rojo).
  * Gráficas interactivas por mes, día y distribución por secretaría.
  * Tabla con paginación configurable (5 por defecto, 10, 20, 50 y personalizado), búsqueda en vivo y filtros.
  * Asistente conversacional de IA integrado en panel flotante.

### 2. Conversar con el Agente Orquestador por Consola (CLI):
```bash
python agente_orquestador/orquestador_principal.py
```

### 3. Ejecutar Extractor SIMIT (Modo Consola / Interactivo):
```bash
python main_extractor.py
# O consultas directas:
python main_extractor.py 900123456
python main_extractor.py PAI65E
```
