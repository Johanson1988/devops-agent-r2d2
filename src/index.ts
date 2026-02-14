import { buildApp } from './app';
import { config } from './config';

async function start() {
  try {
    const app = await buildApp();

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, closing server gracefully...`);
        await app.close();
        process.exit(0);
      });
    });

    // Start server
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    console.log(`🚀 DevOps Agent R2D2 running on http://${config.server.host}:${config.server.port}`);
    console.log(`📊 Health check: http://${config.server.host}:${config.server.port}/health`);
    console.log(`🧪 Test endpoint: POST http://${config.server.host}:${config.server.port}/api/test`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
