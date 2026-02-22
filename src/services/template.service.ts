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
  containerPort?: number;
  healthPath?: string;
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
    result = result.replace(/\{\{repoOwner\}\}/g, variables.repoOwner || '');
    result = result.replace(/\{\{repoOwnerLower\}\}/g, (variables.repoOwner || '').toLowerCase());
    result = result.replace(/\{\{type\}\}/g, variables.type || 'custom');
    result = result.replace(/\{\{branch\}\}/g, variables.branch || 'main');
    result = result.replace(/\{\{path\}\}/g, variables.path || 'k8s');
    result = result.replace(/\{\{timestamp\}\}/g, variables.timestamp);

    // Replace domain (direct replacement for infra templates + conditional blocks for README)
    result = result.replace(/\{\{domain\}\}/g, variables.domain || '');
    result = result.replace(/\{\{containerPort\}\}/g, String(variables.containerPort || 80));
    result = result.replace(/\{\{healthPath\}\}/g, variables.healthPath || '/');

    // Handle conditional blocks for domain and port
    if (variables.domain) {
      result = result.replace(/\{\{#if domain\}\}([^]*?)\{\{\/if\}\}/g, (_, content) => content);
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

    // Handle type-based conditional blocks
    const isFront = variables.type === 'front' || !variables.type;
    const isBack = variables.type === 'back';
    const isRemix = variables.type === 'remix';

    if (isFront) {
      result = result.replace(/\{\{#if_front\}\}([^]*?)\{\{\/if_front\}\}/g, (_, content) => content);
    } else {
      result = result.replace(/\{\{#if_front\}\}([^]*?)\{\{\/if_front\}\}/g, '');
    }

    if (isBack) {
      result = result.replace(/\{\{#if_back\}\}([^]*?)\{\{\/if_back\}\}/g, (_, content) => content);
    } else {
      result = result.replace(/\{\{#if_back\}\}([^]*?)\{\{\/if_back\}\}/g, '');
    }

    if (isRemix) {
      result = result.replace(/\{\{#if_remix\}\}([^]*?)\{\{\/if_remix\}\}/g, (_, content) => content);
    } else {
      result = result.replace(/\{\{#if_remix\}\}([^]*?)\{\{\/if_remix\}\}/g, '');
    }

    return result;
  }

  /**
   * Generate docs/PROJECT.md for ForgeBot integration
   */
  generateProjectMd(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'docs/PROJECT.md.template');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating PROJECT.md:', error);
      throw new Error('Failed to generate PROJECT.md');
    }
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
    'CHANGELOG.md': string;
  } {
    return {
      'src/index.html': this.generateIndexHtml(variables),
      'src/nginx.conf': this.generateNginxConfig(),
      'Dockerfile': this.generateDockerfile(),
      '.github/workflows/build.yml': this.generateGithubWorkflow(variables),
      '.dockerignore': this.generateDockerignore(),
      'CHANGELOG.md': this.generateFrontendChangelog(variables),
    };
  }

  /**
   * Generate all backend files
   */
  generateBackendFiles(variables: TemplateVariables): {
    'src/index.ts': string;
    'package.json': string;
    'tsconfig.json': string;
    'Dockerfile': string;
    '.github/workflows/build.yml': string;
    '.dockerignore': string;
    'README.md': string;
    'CHANGELOG.md': string;
  } {
    return {
      'src/index.ts': this.generateBackendIndex(variables),
      'package.json': this.generateBackendPackageJson(variables),
      'tsconfig.json': this.generateBackendTsConfig(),
      'Dockerfile': this.generateBackendDockerfile(),
      '.github/workflows/build.yml': this.generateBackendGithubWorkflow(variables),
      '.dockerignore': this.generateBackendDockerignore(),
      'README.md': this.generateBackendReadme(variables),
      'CHANGELOG.md': this.generateBackendChangelog(variables),
    };
  }

  /**
   * Generate remix-specific files (only the CI workflow — all other
   * files come directly from the remix-pod-starter repo clone).
   */
  generateRemixFiles(variables: TemplateVariables): {
    '.github/workflows/build.yml': string;
  } {
    return {
      '.github/workflows/build.yml': this.generateRemixWorkflow(variables),
    };
  }

  private generateRemixWorkflow(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'remix/build-workflow.yml.template');
      const template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating remix workflow:', error);
      throw new Error('Failed to generate remix workflow');
    }
  }

  /**
   * Generate infra-live Kubernetes manifests for an application.
   * These are placed under apps/<name>/ in the infra-live repository.
   */
  generateInfraFiles(variables: TemplateVariables): Record<string, string> {
    const infraDir = path.join(this.templatesDir, 'infra');
    const templateFiles = ['deployment.yaml', 'service.yaml', 'ingress.yaml', 'kustomization.yaml'];
    const result: Record<string, string> = {};

    for (const file of templateFiles) {
      try {
        const templatePath = path.join(infraDir, `${file}.template`);
        const template = fs.readFileSync(templatePath, 'utf-8');
        result[file] = this.replaceVariables(template, variables);
      } catch (error) {
        console.error(`Error generating infra template ${file}:`, error);
        throw new Error(`Failed to generate infra template: ${file}`);
      }
    }

    return result;
  }

  /**
   * Frontend file generators
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

  private generateNginxConfig(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/nginx.conf.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating nginx.conf:', error);
      throw new Error('Failed to generate nginx.conf');
    }
  }

  private generateDockerfile(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/Dockerfile.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating Dockerfile:', error);
      throw new Error('Failed to generate Dockerfile');
    }
  }

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

  private generateDockerignore(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/.dockerignore.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating .dockerignore:', error);
      throw new Error('Failed to generate .dockerignore');
    }
  }

  /**
   * Backend file generators
   */
  private generateBackendIndex(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/index.ts.template');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating backend index.ts:', error);
      throw new Error('Failed to generate backend index.ts');
    }
  }

  private generateBackendPackageJson(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/package.json.template');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating backend package.json:', error);
      throw new Error('Failed to generate backend package.json');
    }
  }

  private generateBackendDockerfile(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/Dockerfile.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating backend Dockerfile:', error);
      throw new Error('Failed to generate backend Dockerfile');
    }
  }

  private generateBackendGithubWorkflow(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/build-workflow.yml.template');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating backend GitHub workflow:', error);
      throw new Error('Failed to generate backend GitHub workflow');
    }
  }

  private generateBackendDockerignore(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/.dockerignore.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating backend .dockerignore:', error);
      throw new Error('Failed to generate backend .dockerignore');
    }
  }

  private generateBackendReadme(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/README.template.md');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating backend README:', error);
      throw new Error('Failed to generate backend README');
    }
  }

  private generateBackendTsConfig(): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/tsconfig.json.template');
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error generating backend tsconfig.json:', error);
      throw new Error('Failed to generate backend tsconfig.json');
    }
  }

  private generateBackendChangelog(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'back/CHANGELOG.template.md');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating backend CHANGELOG:', error);
      throw new Error('Failed to generate backend CHANGELOG');
    }
  }

  private generateFrontendChangelog(variables: TemplateVariables): string {
    try {
      const templatePath = path.join(this.templatesDir, 'front/CHANGELOG.template.md');
      let template = fs.readFileSync(templatePath, 'utf-8');
      return this.replaceVariables(template, variables);
    } catch (error) {
      console.error('Error generating frontend CHANGELOG:', error);
      throw new Error('Failed to generate frontend CHANGELOG');
    }
  }
}

export const templateService = new TemplateService();
