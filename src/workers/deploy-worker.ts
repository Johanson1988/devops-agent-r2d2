/**
 * Deploy Worker
 * 
 * This script is executed by Jobs (K8s or local process)
 * It performs the actual deployment work:
 * - Create GitHub repositories
 * - Generate manifests
 * - Push to git
 * - Create ArgoCD application
 */

import { DeployRequest } from '../types/job.types';
import { GitHubService } from '../services/github.service';
import { TemplateService } from '../services/template.service';

console.log('Deploy Worker started');
console.log('Args:', process.argv.slice(2));

async function main() {
  try {
    // Parse job data
    const jobData: DeployRequest = process.argv[2] ? JSON.parse(process.argv[2]) : {};
    
    console.log(`Processing deployment: ${jobData.name || 'unknown'}`);
    console.log(`Repository owner: ${jobData.repoOwner}`);

    // Validate required fields
    if (!jobData.name) {
      throw new Error('Missing required field: name');
    }
    if (!jobData.repoOwner) {
      throw new Error('Missing required field: repoOwner');
    }

    // Initialize services
    const githubService = new GitHubService();
    const templateService = new TemplateService();

    // Get repository slug (default to name if not provided)
    const repoSlug = jobData.repoSlug || jobData.name;
    console.log(`Creating repository: ${jobData.repoOwner}/${repoSlug}`);

    // Step 1: Check if repository exists
    console.log('Step 1: Checking if repository already exists...');
    const exists = await githubService.repositoryExists(jobData.repoOwner, repoSlug);
    if (exists) {
      throw new Error(`Repository ${jobData.repoOwner}/${repoSlug} already exists`);
    }
    console.log('✓ Repository does not exist, proceeding with creation');

    // Step 2: Create GitHub repository
    console.log('Step 2: Creating GitHub repository...');
    const result = await githubService.createRepository({
      owner: jobData.repoOwner,
      name: repoSlug,
      description: jobData.description,
      private: jobData.private !== false, // Default to true
    });
    console.log(`✓ Repository created: ${result.repo.html_url}`);

    // Step 3: Generate initial content
    console.log('Step 3: Generating initial repository content...');
    const timestamp = new Date().toISOString();
    
    const readmeContent = templateService.generateReadme({
      name: jobData.name,
      description: jobData.description,
      environment: jobData.environment,
      repoFullName: result.repo.full_name,
      type: jobData.type,
      branch: jobData.branch || 'main',
      domain: jobData.domain,
      port: jobData.port,
      path: jobData.path || 'k8s',
      timestamp,
    });

    const gitignoreContent = templateService.generateGitignore();

    // Step 4: Commit initial files
    console.log('Step 4: Committing initial files to repository...');
    
    // Create README.md
    await githubService.createOrUpdateFile({
      owner: jobData.repoOwner,
      repo: repoSlug,
      path: 'README.md',
      content: readmeContent,
      message: 'Initial commit: Add README',
      branch: 'main',
    });
    console.log('✓ Created README.md');

    // Create .gitignore
    await githubService.createOrUpdateFile({
      owner: jobData.repoOwner,
      repo: repoSlug,
      path: '.gitignore',
      content: gitignoreContent,
      message: 'Initial commit: Add .gitignore',
      branch: 'main',
    });
    console.log('✓ Created .gitignore');

    // Success!
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Deployment completed successfully');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Repository: ${result.repo.html_url}`);
    console.log(`Clone URL: ${result.repo.clone_url}`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ Deployment failed');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('');
    process.exit(1);
  }
}

main();
