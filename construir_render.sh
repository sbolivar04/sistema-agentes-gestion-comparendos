#!/usr/bin/env bash
# ==============================================================================
# Script de Construcción para Render (Entorno Nativo Python + Node.js)
# ==============================================================================
set -e

echo ">>> [1/3] Actualizando pip e instalando dependencias del Backend Python..."
pip install --upgrade pip
pip install -r requirements.txt

echo ">>> [2/3] Instalando dependencias de Node.js y compilando Frontend React..."
cd plataforma_web/cliente
npm ci || npm install
npm run build
cd ../..

echo ">>> [3/3] Compilación finalizada con éxito. Aplicación lista para iniciar."
