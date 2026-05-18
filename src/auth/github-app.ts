import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { config } from '../config';

let cached: Octokit | null = null;

function isAppConfigured(): boolean {
  return Boolean(config.github.appId && config.github.privateKey);
}

function isPatConfigured(): boolean {
  return Boolean(config.github.token);
}

async function buildAppOctokit(): Promise<Octokit> {
  const appId = Number(config.github.appId);
  const privateKey = (config.github.privateKey as string).replace(/\\n/g, '\n');

  let installationId = config.github.installationId
    ? Number(config.github.installationId)
    : null;

  if (!installationId) {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId, privateKey },
    });
    const { data: installations } = await appOctokit.apps.listInstallations();
    if (installations.length === 0) {
      throw new Error('GitHub App has no installations');
    }
    installationId = installations[0].id;
    console.log(`🔑 Resolved GitHub App installation id: ${installationId}`);
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  });
}

export async function getOctokit(): Promise<Octokit> {
  if (cached) return cached;

  if (isAppConfigured()) {
    cached = await buildAppOctokit();
    console.log('🔑 GitHub auth: App installation token');
    return cached;
  }

  if (isPatConfigured()) {
    console.warn('⚠️ GitHub auth: legacy PAT — migrate to App ASAP');
    cached = new Octokit({ auth: config.github.token });
    return cached;
  }

  throw new Error(
    'GitHub auth not configured. Set GITHUB_APP_ID + GITHUB_PRIVATE_KEY (preferred) or GITHUB_TOKEN (legacy).'
  );
}
