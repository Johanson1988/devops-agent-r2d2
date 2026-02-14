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
}

// Singleton instance
export const githubService = new GitHubService();
