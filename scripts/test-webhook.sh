#!/bin/bash
# Script para testear el webhook de Alisios Bot
# Uso: ./test-webhook.sh <secret> [status] [app-name]

WEBHOOK_URL="https://alisios-bot.johannmoreno.dev/webhook/deploy-status"
SECRET="${1:?Webhook secret requerido. Uso: $0 <secret> [status] [app-name]}"
STATUS="${2:-success}"
APP_NAME="${3:-test-app}"

echo "🧪 Testeando webhook de Alisios Bot..."
echo "URL: $WEBHOOK_URL"
echo "Secret: ${SECRET:0:10}..."
echo "Status: $STATUS"
echo "App: $APP_NAME"
echo ""

# Payload
PAYLOAD=$(cat <<EOF
{
  "name": "$APP_NAME",
  "namespace": "default",
  "status": "$STATUS",
  "version": "v1.0.0-test",
  "message": "Prueba del webhook desde ArgoCD Notifications (debug)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

echo "📤 Enviando payload:"
echo "$PAYLOAD" | jq '.' 2>/dev/null || echo "$PAYLOAD"
echo ""

# Envía la petición
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $SECRET" \
  -d "$PAYLOAD")

# Separa respuesta y código
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "📥 Respuesta HTTP $HTTP_CODE:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook test exitoso!"
else
  echo "❌ Error en webhook (HTTP $HTTP_CODE)"
  exit 1
fi
