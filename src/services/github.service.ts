import { Octokit } from '@octokit/rest';
import { config } from '../config';

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
   * Create or update a file in a repository
   */
  async createOrUpdateFile(options: {
    owner: string;
    repo: string;
    path: string;
    content: string;
    message: string;
    branch?: string;
  }): Promise<void> {
    try {
      const { owner, repo, path, content, message, branch = 'main' } = options;

      // Encode content to base64
      const encodedContent = Buffer.from(content).toString('base64');

      // Try to get the file first (to check if it exists)
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });
        if ('sha' in data) {
          sha = data.sha;
        }
      } catch (error: any) {
        // File doesn't exist, which is fine for creation
        if (error.status !== 404) {
          throw error;
        }
      }

      // Create or update the file
      await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: encodedContent,
        branch,
        sha, // Include sha if updating existing file
      });
    } catch (error: any) {
      console.error('Error creating/updating file:', error);
      throw new Error(`Failed to create/update file ${options.path}: ${error.message}`);
    }
  }
}

// Singleton instance
export const githubService = new GitHubService();
