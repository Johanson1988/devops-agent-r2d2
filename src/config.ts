import dotenv from 'dotenv';

// Load .env file in local development
// In K8s, env vars come from ConfigMap/Secrets
dotenv.config();

interface Config {
  github: {
    token: string;
  };
  server: {
    port: number;
    host: string;
  };
  worker: {
    image: string;
  };
  infra: {
    domain: string;
  };
  forgebot: {
    webhookUrl: string;
    webhookSecret: string;
  };
  env: string;
  logLevel: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  github: {
    token: getEnvVar('GITHUB_TOKEN'),
  },
  server: {
    port: parseInt(getEnvVar('PORT', '3000'), 10),
    host: getEnvVar('HOST', '0.0.0.0'),
  },
  worker: {
    image: getEnvVar('WORKER_IMAGE', 'ghcr.io/johanson1988/devops-agent-r2d2:latest'),
  },
  infra: {
    domain: getEnvVar('INFRA_DOMAIN', 'johannmoreno.dev'),
  },
  forgebot: {
    webhookUrl: getEnvVar('FORGEBOT_WEBHOOK_URL', 'https://forge-bot.johannmoreno.dev/webhook'),
    webhookSecret: getEnvVar('FORGEBOT_WEBHOOK_SECRET', ''),
  },
  env: getEnvVar('NODE_ENV', 'development'),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
};
