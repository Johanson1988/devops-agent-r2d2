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
# Update Secret with your GitHub token
kubectl edit secret devops-agent-secrets

# Apply manifests
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -l app=devops-agent-r2d2
kubectl logs -f deployment/devops-agent-r2d2

# Port forward for testing
kubectl port-forward svc/devops-agent-r2d2 3000:80

# Test
curl -X POST http://localhost:3000/api/test
```

## API Endpoints

### POST /api/test
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
