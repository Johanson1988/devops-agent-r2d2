# DevOps Agent R2D2

GitOps automation agent for Kubernetes deployments with ArgoCD.

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

# Create a deployment job
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","type":"static"}'

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

### Deployment Endpoints

#### POST /api/deploy
Create a deployment job. Jobs are queued and executed sequentially.

**Request:**
```bash
curl -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","type":"static"}'
```

**Response:**
```json
{
  "status": "success",
  "message": "Deployment job created",
  "data": {
    "jobId": "deploy-abc123",
    "status": "running",
    "startTime": "2026-02-14T..."
  }
}
```

#### GET /api/deploy/:jobId
Get job status and logs.

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobId": "deploy-abc123",
    "status": "succeeded",
    "request": {"name": "my-app"},
    "startTime": "2026-02-14T...",
    "endTime": "2026-02-14T...",
    "logs": ["[STDOUT] Worker started", "..."]
  }
}
```

#### GET /api/deploy/:jobId/logs
Stream logs in real-time using Server-Sent Events (SSE).

**Usage:**
```bash
curl -N http://localhost:3000/api/deploy/deploy-abc123/logs
```

**Response (SSE):**
```
data: {"log":"Worker started"}
data: {"log":"Processing deploy..."}
data: {"done":true,"status":"succeeded"}
```

### Testing Endpoints

#### POST /api/test
POC endpoint that calls GitHub API and returns authenticated user data.

**Request:**
```bash
curl -X POST http://localhost:3000/api/test
```

**Response:**
```json
{
  "status": "success",
  "message": "GitHub API call successful",
  "data": {
    "user": {
      "login": "username",
      "name": "Full Name",
      "email": "user@example.com",
      "public_repos": 42
    }
  },
  "timestamp": "2026-02-14T..."
}
```

### GET /api/repos
List recent repositories.

### GET /health
Health check endpoint (for K8s liveness probe).

### GET /ready
Readiness check endpoint (for K8s readiness probe).

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
