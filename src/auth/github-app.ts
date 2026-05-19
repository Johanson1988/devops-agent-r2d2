import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { config } from '../config';

let cached: Octokit | null = null;

function appCreds(): { appId: number; privateKey: string; installationId: number } {
  if (!config.github.appId || !config.github.privateKey || !config.github.installationId) {
    throw new Error('GitHub App not configured. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID.');
  }
  return {
    appId: Number(config.github.appId),
    privateKey: config.github.privateKey.replace(/\\n/g, '\n'),
    installationId: Number(config.github.installationId),
  };
}

export async function getOctokit(): Promise<Octokit> {
  if (cached) return cached;
  cached = new Octokit({ authStrategy: createAppAuth, auth: appCreds() });
  return cached;
}

export async function getInstallationToken(): Promise<string> {
  const auth = createAppAuth(appCreds());
  const { token } = await auth({ type: 'installation' });
  return token;
}
