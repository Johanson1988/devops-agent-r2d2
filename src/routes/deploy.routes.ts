import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DeployRequest } from '../types/job.types';
import { jobService } from '../services/job.service';
import { githubService } from '../services/github.service';

export async function deployRoutes(fastify: FastifyInstance) {
  // Create deployment job
  fastify.post<{ Body: DeployRequest }>('/api/deploy', async (request, reply) => {
    try {
      const deployRequest = request.body;

      // Validate request
      if (!deployRequest.name) {
        reply.code(400);
        return {
          status: 'error',
          message: 'Missing required field: name',
        };
      }

      // If repoOwner is not provided, get it from authenticated GitHub user
      if (!deployRequest.repoOwner) {
        try {
          const userData = await githubService.getAuthenticatedUser();
          deployRequest.repoOwner = userData.user.login;
        } catch (error) {
          reply.code(401);
          return {
            status: 'error',
            message: 'Failed to authenticate with GitHub. Please check GITHUB_TOKEN.',
          };
        }
      }

      // Create job
      const job = await jobService.createDeployJob(deployRequest);

      return {
        status: 'success',
        message: job.status === 'pending' 
          ? 'Deployment job queued'
          : 'Deployment job created',
        data: {
          jobId: job.id,
          status: job.status,
          startTime: job.startTime.toISOString(),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      if (message.includes('already in progress')) {
        reply.code(409); // Conflict
      } else {
        reply.code(500);
      }
      
      return {
        status: 'error',
        message,
      };
    }
  });

  // Get job status
  fastify.get<{ Params: { jobId: string } }>('/api/deploy/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params;
      const job = jobService.getJobStatus(jobId);

      if (!job) {
        reply.code(404);
        return {
          status: 'error',
          message: 'Job not found',
        };
      }

      return {
        status: 'success',
        data: {
          jobId: job.id,
          status: job.status,
          request: job.request,
          startTime: job.startTime.toISOString(),
          endTime: job.endTime?.toISOString(),
          logs: job.logs,
          error: job.error,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Stream job logs (Server-Sent Events)
  fastify.get<{ Params: { jobId: string } }>('/api/deploy/:jobId/logs', async (request, reply) => {
    try {
      const { jobId } = request.params;
      const job = jobService.getJobStatus(jobId);

      if (!job) {
        reply.code(404);
        return {
          status: 'error',
          message: 'Job not found',
        };
      }

      // Setup SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Stream logs
      await jobService.streamJobLogs(jobId, (log) => {
        reply.raw.write(`data: ${JSON.stringify({ log })}\n\n`);
      });

      // Send completion event
      reply.raw.write(`data: ${JSON.stringify({ done: true, status: job.status })}\n\n`);
      reply.raw.end();

    } catch (error) {
      reply.code(500);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
