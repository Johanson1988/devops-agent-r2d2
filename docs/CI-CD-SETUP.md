# CI/CD Setup Instructions

## GitHub Container Registry (GHCR) Integration

Este proyecto está configurado para construir y publicar imágenes Docker automáticamente en GitHub Container Registry.

## GitHub Actions Workflow

El workflow `.github/workflows/build.yml` se ejecuta automáticamente cuando:
- Se hace push a la rama `main`
- Se crea un tag con formato `v*` (ej: `v1.0.0`)
- Se crea un Pull Request a `main`

### Tags generados automáticamente:

- `main` - última versión de la rama principal
- `latest` - alias para main (solo en rama default)
- `v1.2.3` - tags semánticos
- `v1.2` - versión mayor.menor
- `sha-abc123` - hash del commit
- `pr-123` - para pull requests

## Configuración de Kubernetes

### 1. Para repositorios públicos

No requiere configuración adicional. La imagen será pública y accesible sin autenticación.

Actualiza el deployment con tu usuario/org de GitHub:

```bash
# En k8s/deployment.yaml, reemplaza OWNER con tu usuario
sed -i 's/OWNER/your-github-username/' k8s/deployment.yaml
```

### 2. Para repositorios privados

Si tu repositorio es privado, necesitas crear un `imagePullSecret`:

```bash
# Crea un Personal Access Token (PAT) en GitHub con permisos read:packages
# https://github.com/settings/tokens/new

# Crea el secret en Kubernetes
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  --docker-email=YOUR_EMAIL \
  -n default

# O usando un archivo YAML
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: default
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: $(echo -n '{"auths":{"ghcr.io":{"username":"YOUR_GITHUB_USERNAME","password":"YOUR_GITHUB_PAT","email":"YOUR_EMAIL","auth":"'$(echo -n "YOUR_GITHUB_USERNAME:YOUR_GITHUB_PAT" | base64)'"}}}'  | base64 -w 0)
EOF
```

Luego agrega el secret al deployment:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: ghcr-secret
      serviceAccountName: devops-agent
      containers:
      - name: agent
        image: ghcr.io/YOUR_USERNAME/devops-agent-r2d2:latest
```

## Construcción manual de la imagen

### Local

```bash
# Build
docker build -t ghcr.io/YOUR_USERNAME/devops-agent-r2d2:latest .

# Test
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  ghcr.io/YOUR_USERNAME/devops-agent-r2d2:latest

# Push manual
echo $GITHUB_PAT | docker login ghcr.io -u YOUR_USERNAME --password-stdin
docker push ghcr.io/YOUR_USERNAME/devops-agent-r2d2:latest
```

### Con buildx (multi-arquitectura)

```bash
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/YOUR_USERNAME/devops-agent-r2d2:latest \
  --push .
```

## Deploy en Kubernetes

```bash
# Actualiza el deployment con tu usuario
export GITHUB_USER=your-github-username
sed -i "s/OWNER/$GITHUB_USER/" k8s/deployment.yaml

# Aplica los manifests
kubectl apply -f k8s/deployment.yaml

# Verifica el despliegue
kubectl get pods -l app=devops-agent-r2d2
kubectl logs -f deployment/devops-agent-r2d2

# Verifica la imagen
kubectl describe pod -l app=devops-agent-r2d2 | grep Image
```

## Versionado Semántico

Para crear un release con tag:

```bash
# Tag y push
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Esto generará automáticamente:
# - ghcr.io/OWNER/devops-agent-r2d2:v1.0.0
# - ghcr.io/OWNER/devops-agent-r2d2:v1.0
# - ghcr.io/OWNER/devops-agent-r2d2:latest (si es default branch)
```

## Seguridad

El Dockerfile implementa las siguientes mejoras de seguridad:

- ✅ Multi-stage build (reduce tamaño)
- ✅ Usuario no-root (nodejs:1001)
- ✅ Actualización de paquetes del sistema
- ✅ Limpieza de cache npm
- ✅ Solo dependencias de producción
- ✅ Health checks configurados
- ✅ Variables de entorno explícitas

## ArgoCD Notifications (Alisios Bot)

El agente configura automáticamente ArgoCD Notifications para enviar el estado
de cada despliegue al webhook de [Alisios Bot](https://alisios-bot.johannmoreno.dev).

### Instalación (una sola vez en el cluster)

```bash
# 1. Instalar el controlador de notificaciones de ArgoCD (si no está instalado)
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/notifications_catalog/install.yaml

# 2. Crear el secret con el token del webhook
kubectl -n argocd create secret generic argocd-notifications-secret \
  --from-literal=webhook-secret=<TU_ALISIOS_WEBHOOK_SECRET>

# 3. Aplicar la configuración de triggers y templates
kubectl apply -f k8s/argocd-notifications.yaml
```

### Cómo funciona

Cada ArgoCD Application creada por el agente incluye estas annotations:

```yaml
annotations:
  notifications.argoproj.io/subscribe.on-deployed.alisios: ""
  notifications.argoproj.io/subscribe.on-health-degraded.alisios: ""
  notifications.argoproj.io/subscribe.on-sync-failed.alisios: ""
  notifications.argoproj.io/subscribe.on-sync-running.alisios: ""
```

Esto hace que ArgoCD envíe un `POST /webhook/deploy-status` a Alisios Bot cuando:

| Trigger               | Cuándo se dispara                        | Status enviado  |
|------------------------|------------------------------------------|-----------------|
| `on-deployed`          | Sync completado + app Healthy            | `success`       |
| `on-health-degraded`   | Health status pasa a Degraded            | `failed`        |
| `on-sync-failed`       | Sync falla (Error/Failed)                | `failed`        |
| `on-sync-running`      | Sync en progreso                         | `in-progress`   |

### Verificar que funciona

```bash
# Ver logs del controlador de notificaciones
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller

# Ver ConfigMap aplicado
kubectl get configmap argocd-notifications-cm -n argocd -o yaml

# Ver annotations de una app
kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.annotations}'
```

## Troubleshooting

### Error: ImagePullBackOff

```bash
# Verifica que la imagen existe
docker pull ghcr.io/YOUR_USERNAME/devops-agent-r2d2:latest

# Para repos privados, verifica el secret
kubectl get secret ghcr-secret -o yaml

# Verifica los eventos
kubectl describe pod POD_NAME
```

### Error: Authentication required

Para repos privados, asegúrate de:
1. Tener un PAT con permisos `read:packages`
2. Crear el imagePullSecret correctamente
3. Añadirlo al deployment

### Ver logs del workflow

Ve a tu repositorio en GitHub:
- Actions → Build and Push Docker Image
- Click en el workflow run para ver detalles
