#!/usr/bin/env bash
# Gera apps/web/public/extensao/ajust-cofre.zip (baixado pelo cofre e pelo Guia de uso, só com
# login). Os arquivos ficam na raiz do zip: o "Extrair tudo" do Windows cria a pasta ajust-cofre
# já com o manifest.json dentro, que é a pasta a escolher no navegador.
# Rode antes de construir a imagem web sempre que extensions/ajust-cofre mudar.
set -euo pipefail
cd "$(dirname "$0")/.."
out="$PWD/apps/web/public/extensao"
mkdir -p "$out"
rm -f "$out/ajust-cofre.zip"
(cd extensions/ajust-cofre && zip -qr -X "$out/ajust-cofre.zip" manifest.json background.js bridge.js icons)
echo "ok: $out/ajust-cofre.zip ($(du -h "$out/ajust-cofre.zip" | cut -f1)), versão $(grep -o '"version": "[^"]*"' extensions/ajust-cofre/manifest.json | cut -d'"' -f4)"
