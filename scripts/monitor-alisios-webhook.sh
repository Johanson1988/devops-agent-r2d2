#!/bin/bash
# Script para monitorear logs del ArgoCD Notifications controller con timestamps

echo "🔍 Iniciando monitoreo de ArgoCD Notifications..."
echo "Los eventos webhook se mostrarán con timestamp."
echo ""
echo "Espera a que una app se sincronice o cambie de estado para ver los eventos."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Monitorea los logs en tiempo real con timestamps
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller \
  -f --tail=50 --timestamps=true | while read line; do
    # Ya tiene timestamp de Kubernetes, pero lo formateamos mejor
    if [[ $line =~ \"time\":\"([^\"]+)\" ]]; then
      time="${BASH_REMATCH[1]}"
      # Agrupa por recurso
      if [[ $line =~ \"resource\":\"argocd/([^\"]+)\" ]]; then
        resource="${BASH_REMATCH[1]}"
        # Busca mensajes de éxito o error
        if [[ $line =~ "webhook" ]]; then
          echo "🌐 [$time] WEBHOOK: $resource"
        elif [[ $line =~ "error" ]]; then
          echo "❌ [$time] ERROR: $resource - $line"
        elif [[ $line =~ "Start processing" ]]; then
          echo "⚙️  [$time] Processing: $resource"
        fi
      fi
    else
      echo "$line"
    fi
  done
