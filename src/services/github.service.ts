import { Octokit } from '@octokit/rest';
import { config } from '../config';
import sodium from 'libsodium-wrappers';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
  }

  /**
   * Get authenticated user information (trivial API call for POC)
   */
  async getAuthenticatedUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        success: true,
        user: {
          login: data.login,
          name: data.name,
          email: data.email,
          public_repos: data.public_repos,
        },
      };
    } catch (error) {
      console.error('GitHub API error:', error);
      throw new Error('Failed to fetch GitHub user data');
    }
  }

  /**
   * List user repositories (another simple call)
   */
  async listRepositories(limit = 5) {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        per_page: limit,
        sort: 'updated',
      });
      
      return {
        success: true,
        repos: data.map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          url: repo.html_url,
        })),
      };
    } catch (error) {
      console.error('GitHub API error:', error);
      throw new Error('Failed to fetch repositories');
    }
  }

  /**
   * Check if a repository exists
   */
  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner,
        repo,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      console.error('Error checking repository:', error);
      throw new Error(`Failed to check if repository exists: ${error.message}`);
    }
  }

  /**
   * Create a new GitHub repository
   */
  async createRepository(options: {
    owner: string;
    name: string;
    description?: string;
    private?: boolean;
  }): Promise<{
    success: boolean;
    repo: {
      name: string;
      full_name: string;
      html_url: string;
      ssh_url: string;
      clone_url: string;
    };
  }> {
    try {
      const { owner, name, description, private: isPrivate = true } = options;

      // Check if repo already exists
      const exists = await this.repositoryExists(owner, name);
      if (exists) {
        throw new Error(`Repository ${owner}/${name} already exists`);
      }

      // Create repository
      // Note: If owner is an organization, use createInOrg, otherwise createForAuthenticatedUser
      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description: description || `Deployment repository for ${name}`,
        private: isPrivate,
        auto_init: false, // We'll initialize it ourselves
      });

      return {
        success: true,
        repo: {
          name: data.name,
          full_name: data.full_name,
          html_url: data.html_url,
          ssh_url: data.ssh_url,
          clone_url: data.clone_url,
        },
      };
    } catch (error: any) {
      console.error('GitHub API error creating repository:', error);
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  }

  /**
   * Create or update an Actions secret on a repository.
   * Uses NaCl sealed box encryption as required by the GitHub API.
   */
  async createRepoSecret(
    owner: string,
    repo: string,
    secretName: string,
    secretValue: string,
  ): Promise<void> {
    try {
      // 1. Get the repository's public key for encrypting secrets
      const { data: publicKeyData } = await this.octokit.actions.getRepoPublicKey({
        owner,
        repo,
      });

      // 2. Encrypt the secret value using NaCl sealed box
      await sodium.ready;
      const binKey = sodium.from_base64(publicKeyData.key, sodium.base64_variants.ORIGINAL);
      const binSecret = sodium.from_string(secretValue);
      const encBytes = sodium.crypto_box_seal(binSecret, binKey);
      const encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

      // 3. Create or update the secret
      await this.octokit.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: publicKeyData.key_id,
      });
    } catch (error: any) {
      console.error('GitHub API error creating secret:', error);
      throw new Error(`Failed to create secret ${secretName}: ${error.message}`);
    }
  }

  /**
   * Create a webhook on a repository.
   */
  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    secret: string,
    events: string[] = ['pull_request', 'issues'],
  ): Promise<void> {
    try {
      await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
        events,
        active: true,
      });
    } catch (error: any) {
      console.error('GitHub API error creating webhook:', error);
      throw new Error(`Failed to create webhook: ${error.message}`);
    }
  }

  /**
   * Create a label on a repository.
   */
  async createLabel(
    owner: string,
    repo: string,
    name: string,
    color: string,
    description?: string,
  ): Promise<void> {
    try {
      await this.octokit.issues.createLabel({
        owner,
        repo,
        name,
        color,
        description,
      });
    } catch (error: any) {
      // If label already exists (422), that's fine
      if (error.status === 422) {
        console.log(`Label "${name}" already exists on ${owner}/${repo}`);
        return;
      }
      console.error('GitHub API error creating label:', error);
      throw new Error(`Failed to create label ${name}: ${error.message}`);
    }
  }
}

// Singleton instance
export const githubService = new GitHubService();
