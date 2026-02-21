#!/bin/bash
# Script para añadir annotations de ArgoCD Notifications a todas las applications existentes

set -e

NAMESPACE="argocd"

echo "🔧 Añadiendo annotations de notificación a todas las ArgoCD Applications..."
echo ""

APPS=$(kubectl get applications -n $NAMESPACE -o jsonpath='{.items[*].metadata.name}')

for app in $APPS; do
  echo "⏳ $app..."
  
  kubectl patch application "$app" -n $NAMESPACE \
    -p '{
      "metadata": {
        "annotations": {
          "notifications.argoproj.io/subscribe.on-deployed.alisios": "",
          "notifications.argoproj.io/subscribe.on-health-degraded.alisios": "",
          "notifications.argoproj.io/subscribe.on-sync-failed.alisios": "",
          "notifications.argoproj.io/subscribe.on-sync-running.alisios": ""
        }
      }
    }' --type=merge > /dev/null 2>&1
  
  echo "✅ $app"
done

echo ""
echo "✨ Done! Todas las applications ahora enviarán notificaciones a Alisios Bot."
echo ""
echo "Verifica con:"
echo "  kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.annotations}' | python3 -m json.tool | grep notifications"
