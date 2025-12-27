#!/usr/bin/env bash
# Aborta imediatamente em qualquer erro
set -o errexit
set -o pipefail

echo "=== 🚀 Iniciando Build da Plataforma Flux ==="

# 1. Instalar todas as dependências (incluindo as de desenvolvimento para o build)
echo "=== 📦 Instalando dependências ==="
npm install --include=dev

# 2. Limpar builds antigos para evitar cache sujo
echo "=== 🧹 Limpando artefatos antigos ==="
rm -rf dist

# 3. Compilar o frontend com o Vite
echo "=== 🏗️ Compilando frontend (Vite) ==="
npm run build

# 4. Verificação de segurança para o Render
if [ ! -d "dist" ]; then
  echo "❌ Erro Crítico: A pasta 'dist' não foi gerada. O deploy vai falhar."
  exit 1
fi

echo "=== ✅ Build concluído com sucesso. Iniciando servidor... ==="