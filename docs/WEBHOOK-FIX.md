# ArgoCD Notifications - Webhook Configuration Status

## Problem Fixed ✅

ArgoCD Notifications webhook was configured correctly, but it wasn't sending notifications because:

1. **Old applications didn't have notification annotations** — Only newly created apps had them
2. All 14 existing ArgoCD Applications needed to be patched with the subscription annotations

## Solution Applied

Patched all ArgoCD Applications in the cluster with notification subscription annotations:

```bash
kubectl patch application <app-name> -n argocd \
  -p '{
    "metadata": {
      "annotations": {
        "notifications.argoproj.io/subscribe.on-deployed.alisios": "",
        "notifications.argoproj.io/subscribe.on-health-degraded.alisios": "",
        "notifications.argoproj.io/subscribe.on-sync-failed.alisios": "",
        "notifications.argoproj.io/subscribe.on-sync-running.alisios": ""
      }
    }
  }' --type=merge
```

Run `scripts/patch-notifications-all-apps.sh` to apply this to all apps in the cluster.

## Testing

Webhook was verified working with curl:
```
$ curl -X POST https://alisios-bot.johannmoreno.dev/webhook/deploy-status \
  -H "X-Webhook-Secret: <secret>" \
  -d '{"name":"test-app","status":"success",...}'

< HTTP/2 200
< {"ok":true,"notified_chat":1022817199}
```

## How It Works Now

1. **App gets created or patched** with notification annotations
2. **ArgoCD detects state change** (Synced, Healthy, Failed, etc.)
3. **Trigger condition matches** (on-deployed, on-sync-failed, etc.)
4. **Webhook POST sent** to `https://alisios-bot.johannmoreno.dev/webhook/deploy-status`
5. **Alisios Bot receives notification** and forwards to Telegram chat

## Monitoring

Watch webhook activity:
```bash
./scripts/monitor-alisios-webhook.sh
```

Test webhook manually:
```bash
./scripts/test-webhook.sh <webhook-secret> [status] [app-name]
```
