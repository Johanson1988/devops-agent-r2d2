import * as fs from 'fs';
import * as path from 'path';

interface TemplateVariables {
  name: string;
  description?: string;
  environment?: string;
  repoFullName: string;
  repoOwner: string;
  type?: string;
  branch?: string;
  domain?: string;
  port?: number;
  path?: string;
  timestamp: string;
}

export class TemplateService {
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
  }

  /**
   * Generate README content
   */
  generateReadme(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'README.template.md');
      let template = fs.readFileSync(templatePath, 'utf-8');

      // Simple template replacement using Handlebars-like syntax
      template = this.replaceVariables(template, variables);

      return template;
    } catch (error) {
      console.error('Error generating README:', error);
      throw new Error('Failed to generate README');
    }
  }

  /**
   * Generate .gitignore content
   */
  generateGitignore(): string {
    try {
      const templatePath = path.join(this.templatesDir, '.gitignore.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating .gitignore:', error);
      throw new Error('Failed to generate .gitignore');
    }
  }

  /**
   * Simple template variable replacement
   */
  private replaceVariables(template: string, variables: TemplateVariables): string {
    let result = template;

    // Replace simple variables {{variable}}
    result = result.replace(/\{\{name\}\}/g, variables.name);
    result = result.replace(/\{\{description\}\}/g, variables.description || 'Application deployment repository');
    result = result.replace(/\{\{environment\}\}/g, variables.environment || 'development');
    result = result.replace(/\{\{repoFullName\}\}/g, variables.repoFullName);
    result = result.replace(/\{\{type\}\}/g, variables.type || 'custom');
    result = result.replace(/\{\{branch\}\}/g, variables.branch || 'main');
    result = result.replace(/\{\{path\}\}/g, variables.path || 'k8s');
    result = result.replace(/\{\{timestamp\}\}/g, variables.timestamp);

    // Handle conditional blocks for domain and port
    if (variables.domain) {
      result = result.replace(/\{\{#if domain\}\}([^]*?)\{\{\/if\}\}/g, (_, content) => {
        return content.replace(/\{\{domain\}\}/g, variables.domain || '');
      });
    } else {
      result = result.replace(/\{\{#if domain\}\}([^]*?)\{\{\/if\}\}/g, '');
    }

    if (variables.port) {
      result = result.replace(/\{\{#if port\}\}([^]*?)\{\{\/if\}\}/g, (_, content) => {
        return content.replace(/\{\{port\}\}/g, String(variables.port || ''));
      });
    } else {
      result = result.replace(/\{\{#if port\}\}([^]*?)\{\{\/if\}\}/g, '');
    }

    return result;
  }

  /**
   * Generate all frontend files
   */
  generateFrontendFiles(variables: TemplateVariables): {
    'src/index.html': string;
    'src/nginx.conf': string;
    'Dockerfile': string;
    '.github/workflows/build.yml': string;
    '.dockerignore': string;
  } {
    return {
      'src/index.html': this.generateIndexHtml(variables),
      'src/nginx.conf': this.generateNginxConfig(),
      'Dockerfile': this.generateDockerfile(),
      '.github/workflows/build.yml': this.generateGithubWorkflow(variables),
      '.dockerignore': this.generateDockerignore(),
    };
  }

  /**
   * Generate index.html for frontend
   */
  private generateIndexHtml(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/index.html.template');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating index.html:', error);
      throw new Error('Failed to generate index.html');
    }
  }

  /**
   * Generate nginx.conf for frontend
   */
  private generateNginxConfig(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/nginx.conf.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating nginx.conf:', error);
      throw new Error('Failed to generate nginx.conf');
    }
  }

  /**
   * Generate Dockerfile for frontend
   */
  private generateDockerfile(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/Dockerfile.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating Dockerfile:', error);
      throw new Error('Failed to generate Dockerfile');
    }
  }

  /**
   * Generate GitHub Actions workflow
   */
  private generateGithubWorkflow(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/build-workflow.yml.template');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating GitHub workflow:', error);
      throw new Error('Failed to generate GitHub workflow');
    }
  }

  /**
   * Generate .dockerignore
   */
  private generateDockerignore(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/.dockerignore.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating .dockerignore:', error);
      throw new Error('Failed to generate .dockerignore');
    }
  }
}

export const templateService = new TemplateService();
