# ==============================================================================
# ETAPA 1: Compilación de la Interfaz Web (React + Vite)
# ==============================================================================
FROM node:20-alpine AS constructor_cliente

WORKDIR /app/plataforma_web/cliente

# Copiar manifiesto de dependencias npm
COPY plataforma_web/cliente/package*.json ./

# Instalar dependencias limpias
RUN npm ci

# Copiar el código fuente del cliente
COPY plataforma_web/cliente/ ./

# Compilar producción (genera plataforma_web/cliente/dist)
RUN npm run build

# ==============================================================================
# ETAPA 2: Entorno de Producción Backend (Python 3.11 + FastAPI)
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

# Parámetros de entorno estándar de Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    DEPURACION=false

# Instalar librerías de sistema mínimas requeridas (psycopg2 / curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código completo de la aplicación
COPY . .

# Copiar el build compilado del frontend generado en la Etapa 1
COPY --from=constructor_cliente /app/plataforma_web/cliente/dist ./plataforma_web/cliente/dist

# Exponer el puerto predeterminado (Render mapea dinámicamente con $PORT)
EXPOSE 8000

# Endpoint de verificación de salud
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/salud || exit 1

# Comando de arranque del servidor
CMD ["python", "main_web.py"]
