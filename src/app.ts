import Fastify from 'fastify';
import { apiRoutes } from './routes/api.routes';
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

  // Register routes
  await fastify.register(apiRoutes);

  return fastify;
}
