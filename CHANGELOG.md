# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-02-15

### Fixed
- Improved Kubernetes pod completion detection with retry logic
- Fixed race condition where pod status check happened before pod reached final state
- Added polling mechanism (up to 10 attempts) to properly detect Succeeded/Failed states
- Jobs now correctly report "succeeded" status when worker completes successfully

## [0.1.2] - 2026-02-15

### Added
- Worker image configuration via `WORKER_IMAGE` environment variable
- Default worker image set to `ghcr.io/johanson1988/devops-agent-r2d2:latest`

### Fixed
- Kubernetes Jobs now use correct GHCR registry image instead of local image
- Changed imagePullPolicy to "Always" for worker containers
- Fixed CreateContainerConfigError due to missing GITHUB_TOKEN secret
- Deployment scaled to 1 replica to fix in-memory job state synchronization (temporary solution)

## [0.1.1] - 2026-02-15

### Added
- Version info in `/health` endpoint response

### Fixed
- Missing RBAC resources (ServiceAccount, Role, RoleBinding) in deployment manifests
- 403 Forbidden error when creating Kubernetes Jobs

### Changed
- Secret creation moved to kubectl command instead of YAML for better security

## [0.1.0] - 2026-02-14

### Added
- **Kubernetes Jobs integration**: Full support for running deployments as K8s Jobs in cluster environments
  - `K8sService` for managing Kubernetes Job lifecycle (create, monitor, delete)
  - Automatic Job creation with proper metadata, labels, and resource limits
  - Real-time Pod log streaming from Kubernetes Jobs
  - Job status monitoring (pending, running, succeeded, failed)
  - Automatic Job cleanup with TTL (1 hour after completion)
  - RBAC configuration: ServiceAccount, Role, and RoleBinding for batch/jobs permissions
- Dual execution mode: Automatically detects environment and executes locally or in Kubernetes
- Job queue system for sequential deployment execution
- Deploy routes: `POST /api/deploy`, `GET /api/deploy/:jobId`, `GET /api/deploy/:jobId/logs`
- Server-Sent Events (SSE) for real-time log streaming
- Environment detection utility (local vs Kubernetes)
- Job status tracking (pending, running, succeeded, failed)
- Automatic queue processing when jobs complete
- 10-minute timeout per job with automatic cleanup
- Worker script stub for deployment logic
- Deploy queue service to manage job execution order
- Local job execution using child processes with stdout/stderr capture
- Initial project setup with TypeScript and Fastify
- GitHub API integration using @octokit/rest
- REST API endpoints:
  - `POST /api/test` - POC endpoint that calls GitHub API to get authenticated user
  - `GET /api/repos` - List user repositories
  - `GET /health` - Health check endpoint for K8s liveness probe
  - `GET /ready` - Readiness check endpoint for K8s readiness probe
- Configuration management:
  - Environment variables support (`.env` file for local development)
  - Centralized config in `src/config.ts`
  - Support for both local and Kubernetes deployments
- Service architecture:
  - `GitHubService` - GitHub API client wrapper
  - `K8sService` - Kubernetes Job management
  - `JobService` - Orchestrates local vs K8s execution
  - `DeployQueueService` - Sequential job queue management
  - Singleton pattern for service instances
- Error handling:
  - Global error handler
  - Proper HTTP status codes
  - Type-safe error responses
- Development setup:
  - TypeScript configuration with strict mode
  - Hot reload with `tsx watch`
  - NPM registry configuration (`.npmrc`)
- Docker support:
  - Multi-stage Dockerfile
  - Non-root user for security
  - Health check built-in
  - Optimized layer caching
- Kubernetes manifests:
  - Deployment with resource limits
  - Service (ClusterIP)
  - ConfigMap for non-sensitive config
  - Secret for GitHub token
  - ServiceAccount with RBAC for batch/jobs
  - Liveness and readiness probes
  - Graceful shutdown support
- Documentation:
  - README with quick start guide
  - API endpoint documentation
  - Local and K8s deployment instructions
  - Environment variables reference

### Changed
- Jobs are now queued instead of rejected when another job is running
- Multiple jobs can be created but execute sequentially
- `job.service.ts` now delegates to `K8sService` when running in Kubernetes cluster

### Fixed
- TypeScript configuration to include Node.js types
- Logger configuration to avoid `pino-pretty` dependency
- Implicit any types in route handlers
- Port conflict handling
- @kubernetes/client-node API compatibility issues (parameter order, response types)

### Technical Details
- **Stack**: Fastify + TypeScript + @octokit/rest + @kubernetes/client-node
- **Node Version**: 20 (Alpine-based Docker image)
- **Target**: ES2022
- **Module System**: CommonJS

[0.1.0]: https://github.com/YOUR_USERNAME/devops-agent-r2d2/releases/tag/v0.1.0
