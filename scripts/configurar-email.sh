#!/usr/bin/env bash
# Liga o envio de e-mail (SMTP) do Ajust ERP em produção.
#
#   1. lê os dados de /home/app/secrets/ajust_erp/smtp.env (fora do repositório)
#   2. testa login no servidor de e-mail e envia uma mensagem de teste
#   3. só se o teste passar: guarda os dados no .env (com cópia de segurança)
#      e recria a API e o worker, esperando ficarem saudáveis
#   4. envia um segundo teste já de dentro da API em execução
#
# Uso:  bash scripts/configurar-email.sh            (faz tudo)
#       bash scripts/configurar-email.sh --so-testar (só os passos 1 e 2, sem mexer no .env)
# A senha nunca é impressa.
set -euo pipefail
umask 077

PROJECT=/home/app/projects/Ajust_ERP
DATA=${SMTP_DATA_FILE:-/home/app/secrets/ajust_erp/smtp.env}
API=${API_CONTAINER:-ajust_erp-api-1}
ONLY_TEST=false
[ "${1:-}" = "--so-testar" ] && ONLY_TEST=true
log() { echo "[e-mail] $*"; }
fail() { echo "[e-mail] ERRO: $*" >&2; exit 1; }

[ -f "$DATA" ] || fail "arquivo $DATA não encontrado."
# Lê só as chaves conhecidas, sem executar o arquivo.
declare -A V
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  key=${line%%=*}; value=${line#*=}
  case "$key" in SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASS|SMTP_FROM|TESTE_PARA) V[$key]=$value ;; esac
done < "$DATA"
for k in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM TESTE_PARA; do
  [ -n "${V[$k]:-}" ] || fail "preencha $k em $DATA."
done
V[SMTP_SECURE]=${V[SMTP_SECURE]:-false}
[[ "${V[SMTP_PORT]}" =~ ^[0-9]+$ ]] || fail "SMTP_PORT precisa ser um número."
[[ "${V[SMTP_SECURE]}" =~ ^(true|false)$ ]] || fail "SMTP_SECURE precisa ser true ou false."
[ ${#V[SMTP_PASS]} -ge 8 ] || fail "SMTP_PASS precisa ter pelo menos 8 caracteres."
for k in SMTP_HOST SMTP_USER SMTP_PASS SMTP_FROM; do
  [[ "${V[$k]}" != *"'"* ]] || fail "$k não pode conter aspas simples (')."
done

send_test() { # $1 = rótulo; $2 = "env" usa a configuração que a API carregou
  local extra=()
  [ "${2:-}" = env ] || extra=(-e T_HOST="${V[SMTP_HOST]}" -e T_PORT="${V[SMTP_PORT]}" \
    -e T_SECURE="${V[SMTP_SECURE]}" -e T_USER="${V[SMTP_USER]}" -e T_PASS="${V[SMTP_PASS]}" \
    -e T_FROM="${V[SMTP_FROM]}")
  docker exec -i "${extra[@]}" -e T_TO="${V[TESTE_PARA]}" -e T_LABEL="$1" "$API" node - <<'JS'
const nodemailer = require('/app/apps/api/node_modules/nodemailer');
const e = (k) => process.env[`T_${k}`] ?? process.env[`SMTP_${k}`];
const t = nodemailer.createTransport({
  host: e('HOST'), port: Number(e('PORT')), secure: e('SECURE') === 'true',
  auth: { user: e('USER'), pass: e('PASS') }, connectionTimeout: 20000,
});
(async () => {
  await t.verify();
  const info = await t.sendMail({
    from: e('FROM'), to: process.env.T_TO,
    subject: `Ajust ERP · teste de envio (${process.env.T_LABEL})`,
    text: `Se você recebeu esta mensagem, o envio de e-mail do Ajust ERP está funcionando (${process.env.T_LABEL}).\n\nhttps://erp.ajustconsulting.com.br`,
  });
  console.log(`[e-mail] ok (${process.env.T_LABEL}): aceito pelo servidor, id ${info.messageId}`);
})().catch((e) => { console.error(`[e-mail] falhou (${process.env.T_LABEL}): ${e.code || ''} ${e.message}`); process.exit(1); });
JS
}

log "testando login e envio em ${V[SMTP_HOST]}:${V[SMTP_PORT]} como ${V[SMTP_USER]}…"
send_test "antes de ativar" || fail "o servidor de e-mail recusou. Nada foi alterado."
if $ONLY_TEST; then log "modo --so-testar: .env e contêineres não foram alterados."; exit 0; fi

cd "$PROJECT"
backup="/home/app/backups/ajust_erp/env.antes-smtp.$(date +%Y%m%d%H%M%S)"
cp .env "$backup"
log "cópia do .env: $backup"
tmp=$(mktemp)
grep -vE '^(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASS|SMTP_FROM)=' .env > "$tmp"
{
  echo ""
  echo "# E-mail (SMTP) · configurado por scripts/configurar-email.sh em $(date '+%d/%m/%Y %H:%M')"
  for k in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM; do
    printf "%s='%s'\n" "$k" "${V[$k]}"
  done
} >> "$tmp"
cat "$tmp" > .env; rm -f "$tmp"

log "recriando API e worker com o e-mail ligado…"
if ! docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate --wait --wait-timeout 240 api worker; then
  log "API ou worker não subiram; restaurando o .env anterior."
  cp "$backup" .env
  docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate --wait --wait-timeout 240 api worker || true
  fail "configuração revertida. Veja: docker logs $API"
fi
docker exec "$API" sh -c 'test -n "$SMTP_HOST"' || fail "a API subiu sem SMTP_HOST; confira o .env."
send_test "API em produção" env
log "pronto: recuperação de senha, avisos, alertas de prazo e pesquisa de satisfação passam a ser enviados."
