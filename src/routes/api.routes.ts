import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { githubService } from '../services/github.service';

export async function apiRoutes(fastify: FastifyInstance) {
  // POC endpoint: POST vacío que llama GitHub API
  fastify.post('/api/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Trivial GitHub API call
      const userData = await githubService.getAuthenticatedUser();
      
      return {
        status: 'success',
        message: 'GitHub API call successful',
        data: userData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(500);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Extra: listar repos (para testing)
  fastify.get('/api/repos', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const repos = await githubService.listRepositories();
      return repos;
    } catch (error) {
      reply.code(500);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Health check (importante para K8s)
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Readiness check (K8s readiness probe)
  fastify.get('/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verificar que GitHub API está accesible
      await githubService.getAuthenticatedUser();
      return { status: 'ready' };
    } catch (error) {
      reply.code(503);
      return { status: 'not ready', error: 'GitHub API unreachable' };
    }
  });
}
