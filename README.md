# DevOps Agent R2D2

GitOps automation agent for Kubernetes deployments with ArgoCD.

**Production Endpoint**: `https://devops-agent-r2d2.johannmoreno.dev`

## Features

- 🚀 **One-Click Deployments**: Create frontend or backend apps with a single API call
- 📦 **Full GitOps Pipeline**: Auto-creates GitHub repos, CI/CD workflows, K8s manifests, and ArgoCD apps
- 🔄 **Auto-Sync**: GitHub Actions builds and pushes to GHCR, ArgoCD syncs automatically
- 🎯 **Two Deployment Types**:
  - **Frontend** (`type: "front"`): Static HTML + nginx
  - **Backend** (`type: "back"`): Node.js Express API with `/health` endpoint
- 🔐 **Secure**: Auto-configures GitHub secrets and imagePullSecrets
- 📊 **Observable**: Real-time logs via Server-Sent Events

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your GitHub token
# GITHUB_TOKEN=ghp_your_token_here

# Run in development mode
npm run dev

# Test the endpoint
curl -X POST http://localhost:3000/api/test

# Check health
curl http://localhost:3000/health
```

## Build

```bash
# TypeScript compilation
npm run build

# Run production build
npm start
```

## Docker

```bash
# Build image
docker build -t devops-agent-r2d2:latest .

# Run container
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=ghp_xxx \
  devops-agent-r2d2:latest

# Test
curl -X POST http://localhost:3000/api/test
```

## Kubernetes Deployment

```bash
# 1. Create the secret with your GitHub token
kubectl create secret generic devops-agent-secrets \
  --from-literal=GITHUB_TOKEN='ghp_your_token_here' \
  -n default

# 2. Apply manifests (includes RBAC for Job creation)
kubectl apply -f k8s/deployment.yaml

# 3. Check status
kubectl get pods -l app=devops-agent-r2d2
kubectl logs -f deployment/devops-agent-r2d2

# Port forward for testing
kubectl port-forward svc/devops-agent-r2d2 3000:80

# Create a frontend deployment (production)
curl -X POST https://devops-agent-r2d2.johannmoreno.dev/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-frontend",
    "type": "front",
    "description": "Mi frontend de ejemplo"
  }'

# Create a backend deployment (production)
curl -X POST https://devops-agent-r2d2.johannmoreno.dev/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mi-api",
    "type": "back",
    "description": "Mi backend de ejemplo"
  }'

# Watch the Kubernetes Job being created
kubectl get jobs -w

# View job logs
kubectl logs job/deploy-xxxxx
```

### RBAC Permissions

The agent requires the following permissions:
- **batch/jobs**: create, get, list, delete, watch
- **pods**: get, list, watch (for log streaming)
- **pods/log**: get (for log access)
- **secrets**: get (for GitHub token access)

These are configured in the ServiceAccount `devops-agent`.

## API Endpoints

### Production Endpoint
All examples below use the production endpoint: `https://devops-agent-r2d2.johannmoreno.dev`

For local development, replace with `http://localhost:3000`

### Deployment Endpoints

#### POST /api/deploy
Create a deployment job. Automatically creates:
1. GitHub repository with project files
2. GitHub Actions workflow (build + push to GHCR)
3. Kubernetes manifests in `infra-live` repo
4. ArgoCD Application for auto-sync

**Frontend Deployment:**
```bash
curl -X POST https://devops-agent-r2d2.johannmoreno.dev/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-frontend",
    "type": "front",
    "description": "My awesome frontend app"
  }'
```

**Backend Deployment:**
```bash
curl -X POST https://devops-agent-r2d2.johannmoreno.dev/api/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-api",
    "type": "back",
    "description": "My awesome backend API"
  }'
```

**Parameters:**
- `name` (required): App name (becomes repo name and domain subdomain)
- `type` (required): `"front"` for frontend (HTML+nginx) or `"back"` for backend (Express API)
- `description` (optional): Repository description
- `domain` (optional): Custom domain (defaults to `<name>.johannmoreno.dev`)
- `repoOwner` (optional): GitHub username (auto-detected from token if not provided)

**Response:**
```json
{
  "status": "success",
  "message": "Deployment job created",
  "data": {
    "jobId": "deploy-mlp9rdyj-oz9wv",
    "status": "running",
    "startTime": "2026-02-16T14:28:07.915Z"
  }
}
```

**What Gets Created:**

*Frontend (type: "front"):*
- ✅ GitHub repo with: `index.html`, `nginx.conf`, `Dockerfile`, GitHub Actions workflow
- ✅ Nginx-based static site on port 80
- ✅ Live at: `https://<name>.johannmoreno.dev`

*Backend (type: "back"):*
- ✅ GitHub repo with: `index.js`, `package.json`, `Dockerfile`, GitHub Actions workflow
- ✅ Express API with `/health` endpoint on port 3000
- ✅ Live at: `https://<name>.johannmoreno.dev/health`

#### GET /api/deploy/:jobId
Get job status and logs.

**Example:**
```bash
curl https://devops-agent-r2d2.johannmoreno.dev/api/deploy/deploy-mlp9rdyj-oz9wv
```

**Response (Running):**
```json
{
  "status": "success",
  "data": {
    "jobId": "deploy-mlp9rdyj-oz9wv",
    "status": "running",
    "request": {"name": "my-api", "type": "back"},
    "startTime": "2026-02-16T14:28:07.915Z",
    "logs": [
      "[STDOUT] Starting deployment job...",
      "[STDOUT] Creating GitHub repository my-api...",
      "[STDOUT] Repository created successfully"
    ]
  }
}
```

**Response (Completed):**
```json
{
  "status": "success",
  "data": {
    "jobId": "deploy-mlp9rdyj-oz9wv",
    "status": "succeeded",
    "request": {"name": "my-api", "type": "back"},
    "startTime": "2026-02-16T14:28:07.915Z",
    "endTime": "2026-02-16T14:30:45.123Z",
    "logs": [
      "[STDOUT] Starting deployment job...",
      "[STDOUT] Creating GitHub repository my-api...",
      "[STDOUT] Repository created: https://github.com/johanson1988/my-api",
      "[STDOUT] Creating deployment files...",
      "[STDOUT] Pushing files to GitHub...",
      "[STDOUT] Creating infrastructure manifests...",
      "[STDOUT] ✅ Deployment successful!",
      "[STDOUT] App will be live at: https://my-api.johannmoreno.dev"
    ]
  }
}
```

**Response (Failed):**
```json
{
  "status": "success",
  "data": {
    "jobId": "deploy-mlp9rdyj-oz9wv",
    "status": "failed",
    "request": {"name": "my-api", "type": "back"},
    "startTime": "2026-02-16T14:28:07.915Z",
    "endTime": "2026-02-16T14:28:15.456Z",
    "logs": [
      "[STDOUT] Starting deployment job...",
      "[STDERR] Error: Repository my-api already exists"
    ]
  }
}
```

#### GET /api/deploy/:jobId/logs
Stream logs in real-time using Server-Sent Events (SSE).

**Example:**
```bash
curl -N https://devops-agent-r2d2.johannmoreno.dev/api/deploy/deploy-mlp9rdyj-oz9wv/logs
```

**Response (SSE):**
```
data: {"log":"[STDOUT] Worker started"}
data: {"log":"[STDOUT] Creating GitHub repository..."}
data: {"log":"[STDOUT] Repository created successfully"}
data: {"done":true,"status":"succeeded"}
```

### Job Queue

#### GET /api/jobs
Get current job queue status.

**Example:**
```bash
curl https://devops-agent-r2d2.johannmoreno.dev/api/jobs
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "currentJob": {
      "jobId": "deploy-abc123",
      "type": "deploy",
      "status": "running",
      "startTime": "2026-02-16T14:28:07.915Z",
      "request": {"name": "my-app", "type": "front"}
    },
    "queuedJobs": [
      {
        "jobId": "deploy-xyz789",
        "type": "deploy",
        "queuedAt": "2026-02-16T14:30:12.345Z",
        "request": {"name": "another-app", "type": "back"}
      }
    ]
  }
}
```

### Testing Endpoints

#### POST /api/test
POC endpoint that calls GitHub API and returns authenticated user data.

**Example:**
```bash
curl -X POST https://devops-agent-r2d2.johannmoreno.dev/api/test
```

**Response:**
```json
{
  "status": "success",
  "message": "GitHub API call successful",
  "data": {
    "user": {
      "login": "johanson1988",
      "name": "Johann Moreno",
      "email": "johann@example.com",
      "public_repos": 42
    }
  },
  "timestamp": "2026-02-16T14:35:22.789Z"
}
```

#### GET /api/repos
List recent repositories.

**Example:**
```bash
curl https://devops-agent-r2d2.johannmoreno.dev/api/repos
```

### Health Checks

#### GET /health
Health check endpoint (for Kubernetes liveness probe).

**Example:**
```bash
curl https://devops-agent-r2d2.johannmoreno.dev/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-16T14:35:22.789Z"
}
```

#### GET /ready
Readiness check endpoint (for Kubernetes readiness probe).

**Example:**
```bash
curl https://devops-agent-r2d2.johannmoreno.dev/ready
```

---

## Testing Your Deployed Apps

After deployment completes (usually takes 2-3 minutes), your apps are accessible via HTTPS:

**Frontend Example:**
```bash
# Assuming you deployed: {"name":"my-frontend","type":"front"}
curl https://my-frontend.johannmoreno.dev
# Returns: HTML content
```

**Backend Example:**
```bash
# Assuming you deployed: {"name":"my-api","type":"back"}
curl https://my-api.johannmoreno.dev/health
# Returns: {"status":"ok","version":"1.0.0"}
```

**Important Notes:**
- ✅ All deployed apps use HTTPS only (enforced by Traefik ingress)
- ✅ Certificates are automatically provisioned by cert-manager via Let's Encrypt
- ✅ HTTP requests are automatically redirected to HTTPS
- ✅ DNS is managed by Cloudflare
- ✅ ArgoCD auto-syncs changes from the `infra-live` repository

---

## Project Structure

```
devops-agent-r2d2/
├── src/
│   ├── index.ts              # Server entrypoint
│   ├── app.ts                # Fastify app setup
│   ├── config.ts             # Configuration management
│   ├── routes/
│   │   └── api.routes.ts     # API endpoints
│   └── services/
│       └── github.service.ts # GitHub API client
├── k8s/
│   └── deployment.yaml       # Kubernetes manifests
├── Dockerfile                # Multi-stage build
├── package.json
└── tsconfig.json
```

## Features

### Job Execution
- **Local Mode**: Executes jobs as child processes (for development)
- **Kubernetes Mode**: Creates K8s Jobs for isolated execution (production)
- **Auto-detection**: Automatically detects environment and uses appropriate method
- **Sequential Processing**: One deployment at a time, others queued
- **Real-time Logs**: SSE streaming for live log updates
- **Automatic Cleanup**: Jobs cleaned up after completion (TTL: 1 hour in K8s)
- **Timeout**: 10-minute timeout per job

### API Features
- RESTful endpoints for job management
- Server-Sent Events for log streaming
- Job status tracking and history
- Health and readiness checks for K8s

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Required |
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

## Development

```bash
# Watch mode with auto-reload
npm run dev

# Type checking
npm run type-check

# Lint (when configured)
npm run lint
```
