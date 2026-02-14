# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
- Jobs are now queued instead of rejected when another job is running
- Multiple jobs can be created but execute sequentially

## [0.1.0] - 2026-02-14

### Added
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
  - Liveness and readiness probes
  - Graceful shutdown support
-Unreleased]: https://github.com/YOUR_USERNAME/devops-agent-r2d2/compare/v0.1.0...HEAD
[ Documentation:
  - README with quick start guide
  - API endpoint documentation
  - Local and K8s deployment instructions
  - Environment variables reference

### Fixed
- TypeScript configuration to include Node.js types
- Logger configuration to avoid `pino-pretty` dependency
- Implicit any types in route handlers
- Port conflict handling

### Technical Details
- **Stack**: Fastify + TypeScript + @octokit/rest
- **Node Version**: 20 (Alpine-based Docker image)
- **Target**: ES2022
- **Module System**: CommonJS

[0.1.0]: https://github.com/YOUR_USERNAME/devops-agent-r2d2/releases/tag/v0.1.0
