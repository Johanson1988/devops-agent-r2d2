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
  env: getEnvVar('NODE_ENV', 'development'),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
};
