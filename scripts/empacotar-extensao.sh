#!/usr/bin/env bash
# Gera apps/web/public/extensao/ajust-cofre.zip (baixado pelo Guia de uso, só com login).
# Rode antes de construir a imagem web sempre que extensions/ajust-cofre mudar.
set -euo pipefail
cd "$(dirname "$0")/.."
out=apps/web/public/extensao
mkdir -p "$out"
rm -f "$out/ajust-cofre.zip"
(cd extensions && zip -qr -X "../$out/ajust-cofre.zip" ajust-cofre -x '*.DS_Store')
echo "ok: $out/ajust-cofre.zip ($(du -h "$out/ajust-cofre.zip" | cut -f1)), versão $(grep -o '"version": "[^"]*"' extensions/ajust-cofre/manifest.json | cut -d'"' -f4)"
