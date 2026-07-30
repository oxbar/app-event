#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="https://api-sandbox.asaas.com/v3"
USER_AGENT="event-access-platform/1.0"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

usage() {
  cat <<'EOF'
Uso:
  ./approve-asaas-payment.sh CODIGO_DO_PEDIDO

Exemplo:
  ./approve-asaas-payment.sh ORD-ABC123

Requisitos:
  - bash
  - curl
  - jq
  - arquivo .env no mesmo diretório do script
EOF
}

fail() {
  printf 'Erro: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  unset API_KEY
  unset ENCODED_ORDER_CODE
  unset PAYMENT_ID
}
trap cleanup EXIT

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

ORDER_CODE="$1"

[[ -n "${ORDER_CODE//[[:space:]]/}" ]] \
  || fail "O código do pedido não pode estar vazio."

command -v curl >/dev/null 2>&1 \
  || fail "curl não está instalado."

command -v jq >/dev/null 2>&1 \
  || fail "jq não está instalado."

[[ -f "$ENV_FILE" ]] \
  || fail "Arquivo .env não encontrado em ${ENV_FILE}"

# Lê apenas a primeira ocorrência de ASAAS_API_KEY.
# Remove CR de arquivos Windows, espaços laterais e aspas externas.
API_KEY="$(
  awk '
    /^ASAAS_API_KEY=/ {
      sub(/^[^=]*=/, "")
      print
      exit
    }
  ' "$ENV_FILE" \
  | tr -d '\r'
)"

API_KEY="$(
  printf '%s' "$API_KEY" \
  | sed -E \
      -e 's/^[[:space:]]+//' \
      -e 's/[[:space:]]+$//' \
      -e "s/^'(.*)'$/\1/" \
      -e 's/^"(.*)"$/\1/'
)"

[[ -n "$API_KEY" ]] \
  || fail "ASAAS_API_KEY não encontrada ou está vazia no arquivo .env."

ENCODED_ORDER_CODE="$(
  jq -nr \
    --arg value "$ORDER_CODE" \
    '$value | @uri'
)"

printf 'Procurando cobrança do pedido %s...\n' "$ORDER_CODE"

SEARCH_RESPONSE="$(
  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --get \
    "${BASE_URL}/payments" \
    --data-urlencode "externalReference=${ORDER_CODE}" \
    --data-urlencode "limit=1" \
    --header "access_token: ${API_KEY}" \
    --header "User-Agent: ${USER_AGENT}" \
    --header "Accept: application/json"
)" || fail "Falha ao consultar a cobrança no Asaas Sandbox."

PAYMENT_ID="$(
  jq -r '.data[0].id // empty' <<<"$SEARCH_RESPONSE"
)"

PAYMENT_STATUS="$(
  jq -r '.data[0].status // empty' <<<"$SEARCH_RESPONSE"
)"

PAYMENT_VALUE="$(
  jq -r '.data[0].value // empty' <<<"$SEARCH_RESPONSE"
)"

PAYMENT_REFERENCE="$(
  jq -r '.data[0].externalReference // empty' <<<"$SEARCH_RESPONSE"
)"

[[ -n "$PAYMENT_ID" ]] \
  || fail "Cobrança não encontrada no Asaas para o pedido ${ORDER_CODE}."

printf '\nCobrança encontrada:\n'
printf '  ID:                 %s\n' "$PAYMENT_ID"
printf '  Status:             %s\n' "$PAYMENT_STATUS"
printf '  Valor:              %s\n' "$PAYMENT_VALUE"
printf '  Referência externa: %s\n' "$PAYMENT_REFERENCE"

case "$PAYMENT_STATUS" in
  RECEIVED|CONFIRMED)
    printf '\nEssa cobrança já está aprovada: %s\n' "$PAYMENT_STATUS"
    exit 0
    ;;
esac

printf '\nConfirmando pagamento no Asaas Sandbox...\n'

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --request POST \
  "${BASE_URL}/sandbox/payment/${PAYMENT_ID}/confirm" \
  --header "access_token: ${API_KEY}" \
  --header "User-Agent: ${USER_AGENT}" \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data '{}' \
  >/dev/null \
  || fail "Falha ao confirmar o pagamento no Asaas Sandbox."

# O status pode levar alguns segundos para refletir.
FINAL_STATUS=""

for attempt in 1 2 3 4 5; do
  sleep 2

  STATUS_RESPONSE="$(
    curl \
      --fail-with-body \
      --silent \
      --show-error \
      --request GET \
      "${BASE_URL}/payments/${PAYMENT_ID}/status" \
      --header "access_token: ${API_KEY}" \
      --header "User-Agent: ${USER_AGENT}" \
      --header "Accept: application/json"
  )" || fail "Falha ao consultar o novo status da cobrança."

  FINAL_STATUS="$(
    jq -r '.status // empty' <<<"$STATUS_RESPONSE"
  )"

  case "$FINAL_STATUS" in
    RECEIVED|CONFIRMED)
      break
      ;;
  esac

  printf 'Aguardando confirmação... tentativa %s/5, status atual: %s\n' \
    "$attempt" \
    "${FINAL_STATUS:-desconhecido}"
done

printf '\nNovo status no Asaas: %s\n' "${FINAL_STATUS:-desconhecido}"

case "$FINAL_STATUS" in
  RECEIVED|CONFIRMED)
    printf 'Pagamento aprovado com sucesso no Sandbox.\n'
    ;;
  *)
    fail "Status inesperado após confirmação: ${FINAL_STATUS:-vazio}"
    ;;
esac
