# Debugging: ArgoCD Notifications Webhook

Si el webhook a Alisios Bot no está funcionando, sigue estos pasos para identificar el problema.

## 1. Ver logs del controller con timestamps

```bash
# Terminal 1: Monitorea logs en tiempo real
./scripts/monitor-alisios-webhook.sh

# O manualmente:
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller \
  -f --timestamps=true --tail=100
```

Con el flag `--loglevel=debug` verás:
- Cuándo se procesan las apps
- Cuándo se evalúan los triggers
- Intentos fallidos de envío de webhooks
- Todo con timestamp exacto

## 2. Verificar la configuración está aplicada

```bash
# Ver ConfigMap
kubectl get configmap argocd-notifications-cm -n argocd -o jsonpath='{.data}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("\n".join(d.keys()))'

# Ver Secret
kubectl get secret argocd-notifications-secret -n argocd -o jsonpath='{.data}' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f"Secret keys: {list(d.keys())}")'

# Ver una aplicación específica
kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.annotations}' | python3 -m json.tool
```

Debe mostrar estas annotations:
```json
{
  "notifications.argoproj.io/subscribe.on-deployed.alisios": "",
  "notifications.argoproj.io/subscribe.on-health-degraded.alisios": "",
  "notifications.argoproj.io/subscribe.on-sync-failed.alisios": "",
  "notifications.argoproj.io/subscribe.on-sync-running.alisios": ""
}
```

## 3. Testear el webhook manualmente

```bash
# Necesitas el webhook secret
./scripts/test-webhook.sh "njdfngngvdkjbgfscdjkngdsjkvgncsfdkjgnksdj5885855775fj"

# Con diferentes estados
./scripts/test-webhook.sh "SECRET" "success" "my-app"
./scripts/test-webhook.sh "SECRET" "failed" "my-app"
./scripts/test-webhook.sh "SECRET" "in-progress" "my-app"
```

Si obtienes `200`, el webhook funciona. Si es `401`, revisa el secret.

## 4. Trigger una sincronización manual

```bash
# Fuerza a una app que se sincronice
argocd app sync <app-name>

# O vía kubectl
kubectl patch application <app-name> -n argocd \
  -p '{"spec":{"syncPolicy":{"automated":null}}}' --type merge
kubectl patch application <app-name> -n argocd \
  -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}' --type merge
```

Luego monitorea los logs para ver si se dispara el webhook.

## 5. Verificar logs en el servidor de Alisios

Si el webhook llega, Alisios debe tener logs. En su lado:

```bash
# Ver logs de Alisios Bot (si está en Kubernetes)
kubectl logs -n alisios -f -l app=alisios-bot

# O si usas docker-compose
docker-compose -f alisios-bot/docker-compose.yml logs -f bot
```

## 6. Problemas comunes

### "unexpected \\\\ in operand"
Ya está solucionado en la versión actual. Si sigue ocurriendo, verifica que `k8s/argocd-notifications.yaml` esté actualizado.

### El webhook nunca se dispara
- La app no está suscrita (falta annotations)
- El trigger no se cumple (la app nunca pasa a Healthy, nunca falla, etc.)
- El controller no está viendo la annotation

Solución:
```bash
# Restart del controller para que recargue la config
kubectl rollout restart deployment argocd-notifications-controller -n argocd

# Verifica que el pod nuevo cargó la config
kubectl wait --for=condition=available --timeout=30s \
  deployment/argocd-notifications-controller -n argocd
```

### Error 401 (Unauthorized)
El websocket secret no coincide. Verifica:

```bash
kubectl get secret argocd-notifications-secret -n argocd \
  -o jsonpath='{.data.webhook-secret}' | base64 -d
```

Y comprueba que coincida con el valor usado en `test-webhook.sh`.

### Error 5xx desde Alisios
Hay un problema en el servidor de Alisios. Ver sus logs.

---

## Script de diagnóstico completo

```bash
#!/bin/bash
set -e

echo "🔍 Diagnóstico de ArgoCD Notifications → Alisios Bot"
echo ""

echo "1️⃣  ConfigMap aplicado:"
kubectl get configmap argocd-notifications-cm -n argocd -o jsonpath='{.data.service.webhook.alisios}'
echo ""

echo "2️⃣  Secret existe:"
kubectl get secret argocd-notifications-secret -n argocd --no-headers
echo ""

echo "3️⃣  Controller está ready:"
kubectl get deployment argocd-notifications-controller -n argocd --no-headers
echo ""

echo "4️⃣  Últimos logs del controller:"
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller --tail=10
echo ""

echo "5️⃣  Apps con annotations de notificación:"
kubectl get applications -n argocd -o jsonpath='{range .items[?(.metadata.annotations.notifications\.argoproj\.io/subscribe\.on-deployed\.alisios)]}{"- "}{.metadata.name}{"\n"}{end}'
echo ""

echo "✅ Diagnóstico completado"
```
