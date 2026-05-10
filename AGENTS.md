# AGENTS.md — Singularidades del proyecto (devops-agent-r2d2)

> **Único archivo de instrucciones**. Léelo antes de cambiar nada.
> `CLAUDE.md` y `.github/copilot-instructions.md` son symlinks aquí.
> Solo singularidades NO deducibles del código. Convenciones genéricas TS/Node ya las sabes.

## 1. Ecosistema cluster (singularidades NO deducibles)

- **Cluster**: k3s personal Hetzner (`coruscant`), ns `bots|webs|tools` (NUNCA `default`, vacío post-migración). DB: Postgres en Neon externo. GitOps: Argo CD ↔ repo `infra-live` (App-of-Apps).
- **Secrets**: bitnami sealed-secrets. Cifrados en `infra-live/apps/<app>/secret.sealed.yaml`. Local dev: `direnv allow` (helper `use_kube_secret` pulls cluster, cache `.direnv/secrets/` 1h). Rotar/crear: `POST http://devops-agent-r2d2.bots.svc.cluster.local/api/reseal-secret` con `{namespace,name,data}`. **NUNCA** commitear plain secrets, ni `.env` con valores reales, ni `kubectl create secret` directo.
- **Deploy**: CI `.github/workflows/build.yml` — `on:push main` build+push GHCR + `update-infra` job bumpea tag en infra-live (Argo redeploys prod). `on:pull_request` build solo con `sha-<head_sha[:7]>` (NO bump). NUNCA scripts deploy custom ni `kubectl apply` directo.
- **Intra-cluster comms**: ClusterIP DNS `<svc>.<ns>.svc.cluster.local` (mismo ns: `<svc>`). **NUNCA** URL pública (`*.johannmoreno.dev`) desde código en cluster — rompe hairpin NAT.
- **PR preview**: label `preview` en PR → ApplicationSet detecta (poll 30min) → crea ns `preview-<app>-pr-N` con kustomize override (ns + image tag + ingress host) → URL `<app>-pr-N.johannmoreno.dev`. Reflector replica `ghcr-secret` y per-app secrets a esa ns. Cierra PR → cleanup auto (Application + resources, ns ephemeral persiste).
- **App nueva**: Telegram alisios-bot → "crear repositorio remix que [...]" → devops-agent worker scaffold full. O fork manual de `remix-pod-starter` + replace placeholders.
- **NetworkPolicies**: default-deny per ns. Allow: DNS, traefik ingress (kube-system), egress internet (excluyendo cluster CIDR), intra-ns. Cross-ns blocked.
- **Mesh VPN**: Headscale self-hosted (`headscale.johannmoreno.dev`). SSH a coruscant solo via tailnet (`100.64.0.0/10`) o IP residencial fallback.

## Reglas duras (NUNCA)

- ❌ `namespace: default` hardcoded en manifests k8s. Usa kustomize `namespace:` field o Argo destination.namespace.
- ❌ Secrets plain en código/env/commits/PR descriptions.
- ❌ `.env` real committed (`.env.example` sí, sin valores).
- ❌ `kubectl apply -f`, `helm install`, deploy scripts custom en CI/Makefile.
- ❌ URL pública `*.johannmoreno.dev` desde código corriendo en cluster.
- ❌ Modificar job `update-infra` de build.yml (probado, no romper).
- ❌ Postgres Deployment en cluster (DB es Neon externo).
- ❌ Crear Argo Application a mano vía `kubectl apply` (usar pattern App-of-Apps via repo).

## Profundidad

Notas Mente Digital del usuario (`mente-digital.johannmoreno.dev`, search `cluster coruscant`): 16+ notas con arquitectura completa — sealed-secrets, App-of-Apps, NetworkPolicies, Reflector, ApplicationSet PR previews, /api/reseal-secret, Headscale, saga debug 2026-05-09/10, etc.

`infra-live` repo = GitOps source of truth. Estructura:
- `apps/<app>/` — manifests (deployment+service+ingress+kustomization+secret.sealed)
- `apps/_apps/` — Argo Application CRs
- `apps/_appsets/` — ApplicationSet PR generators
- `apps/shared-{bots,webs,tools}/` — SealedSecrets compartidos
- `apps/{reflector,sealed-secrets,traefik-middlewares,headscale,argocd-config}/` — infra components
- `root.yaml` — bootstrap (kubectl apply una vez)

## 2. Singularidades de `devops-agent-r2d2`

### Qué es
Fastify HTTP API que orquesta deploys via K8s Jobs + GitHub API. Recibe llamadas de alisios-bot Telegram para scaffold de apps nuevas, y expone endpoint para rotación secrets.

- **ns**: `bots`. Secret per-app: `devops-agent-secrets`. ServiceAccount: `devops-agent`.
- **Stack**: Node TypeScript + Fastify + @kubernetes/client-node + Octokit.
- **Endpoints**:
  - `GET /health`, `GET /ready`
  - `POST /api/test`
  - `GET /api/repos`
  - `POST /api/deploy` — scaffold app new (body: `{name, type, description, repoOwner}`)
  - `GET /api/deploy/:jobId`, `GET /api/deploy/:jobId/logs`
  - `POST /api/reseal-secret` — sellar secret arbitrario (body: `{namespace, name, data}`) → returns SealedSecret YAML
- **RBAC**: Role `devops-agent-role` en `bots` (jobs, pods). RoleBinding `devops-agent-app-creator` en `argocd` ns para crear Argo Applications cross-ns.
- **Worker Jobs**: spawn en pod's `POD_NAMESPACE` (Downward API en deployment env). Image = misma del agent (resuelta vía pod self-read).

### Singularidades CRÍTICAS
- `private namespace = process.env.POD_NAMESPACE || 'default'` — **NUNCA hardcodear**. La saga 2026-05-09/10 rompió en este bug.
- Worker `FORGEBOT_WEBHOOK_URL` = `http://forge-bot.bots.svc.cluster.local/webhook` (internal). NUNCA URL pública.
- `resolveTargetNamespace(type)`: api/back → `bots`, otherwise → `webs`. Argo Application destination.namespace lo usa.
- Templates en `src/templates/infra/*.yaml.template`: NO `namespace:` hardcoded. `kustomization.yaml.template` tiene `namespace: {{namespace}}` (kustomize transformer).
- Image tag override en kustomize.images: `sha-{{head_short_sha_7}}` para PR previews — coincide con CI tag (CI checkout `pull_request.head.sha`, NO merge sha).
- kubeseal binary instalado en Dockerfile para `/api/reseal-secret`. Versión pinned a sealed-secrets app v0.36.6 del cluster.
- Worker creates Argo Application via `customApi.createNamespacedCustomObject`. Necesita perm cross-ns argocd (provista por RoleBinding en infra-live).
