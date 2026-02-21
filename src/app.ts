import Fastify, { FastifyRequest } from 'fastify';
import { apiRoutes } from './routes/api.routes';
import { deployRoutes } from './routes/deploy.routes';
import { config } from './config';

export async function buildApp() {
  const fastify = Fastify({
    logger: config.env === 'development' ? {
      level: config.logLevel,
      transport: {
        target: 'pino/file',
        options: { destination: 1 } // stdout
      }
    } : {
      level: config.logLevel
    },
  });

  // Global error handler
  fastify.setErrorHandler((error: Error, _request, reply) => {
    fastify.log.error(error);
    reply.status(500).send({
      status: 'error',
      message: config.env === 'production' ? 'Internal server error' : error.message,
    });
  });

  // Silence health/ready check logs to reduce noise
  const isHealthCheck = (req: FastifyRequest): boolean => {
    return req.url === '/health' || req.url === '/ready';
  };

  // Wrap logger to skip health endpoint logs
  const originalInfo = fastify.log.info.bind(fastify.log);
  fastify.log.info = function (obj: any, ...args: any[]) {
    if (obj?.req?.url && isHealthCheck(obj.req)) return;
    originalInfo(obj, ...args);
  };

  // Register routes
  await fastify.register(apiRoutes);
  await fastify.register(deployRoutes);

  return fastify;
}
