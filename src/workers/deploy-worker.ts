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
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

console.log('Deploy Worker started');
console.log('Args:', process.argv.slice(2));
console.log('🔍 DEBUG: Worker version v0.3.1-debug-f5650bd');

async function main() {
  try {
    // Parse job data
    const jobData: DeployRequest = process.argv[2] ? JSON.parse(process.argv[2]) : {};
    
    console.log(`Processing deployment: ${jobData.name || 'unknown'}`);
    console.log('🔍 DEBUG: After printing deployment name');
    console.log(`Repository owner: ${jobData.repoOwner}`);
    console.log('🔍 DEBUG: After printing repo owner');

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

    // Determine deployment type (default to 'front')
    const deploymentType = jobData.type || 'front';
    console.log(`Deployment type: ${deploymentType}`);

    // Check if type is supported
    if (deploymentType === 'back') {
      throw new Error('Backend deployments are not implemented yet. Please use type: "front" for now.');
    }

    if (deploymentType !== 'front') {
      throw new Error(`Unknown deployment type: ${deploymentType}. Supported types: front, back`);
    }

    // Step 3: Generate initial content
    console.log('Step 3: Generating initial repository content...');
    const timestamp = new Date().toISOString();
    
    const variables = {
      name: jobData.name,
      description: jobData.description || `${jobData.name} - GitOps deployment`,
      environment: jobData.environment,
      repoFullName: result.repo.full_name,
      repoOwner: jobData.repoOwner,
      type: jobData.type,
      branch: jobData.branch || 'main',
      domain: jobData.domain,
      port: jobData.port,
      path: jobData.path || 'k8s',
      timestamp,
    };

    const readmeContent = templateService.generateReadme(variables);
    const gitignoreContent = templateService.generateGitignore();

    // Step 4: Generate project-specific files based on type
    console.log('Step 4: Generating project files...');
    let projectFiles: Record<string, string> = {};

    if (deploymentType === 'front') {
      console.log('📦 Generando archivos de aplicación frontend...');
      projectFiles = templateService.generateFrontendFiles(variables);
      console.log(`✓ Generated ${Object.keys(projectFiles).length} frontend files`);
      console.log('   Archivos generados:');
      Object.keys(projectFiles).forEach(filePath => {
        const size = projectFiles[filePath].length;
        console.log(`   - ${filePath} (${size} bytes)`);
      });
    }

    // Step 5: Clone repo locally, create files, and push
    console.log('Step 5: Clonando repositorio y creando archivos...');
    console.log('');
    
    // Create temporary directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devops-agent-'));
    console.log(`📁 Directorio temporal: ${tmpDir}`);
    
    try {
      // Clone the repository
      console.log(`📥 Clonando repositorio...`);
      const cloneUrl = result.repo.clone_url.replace('https://', `https://${process.env.GITHUB_TOKEN}@`);
      execSync(`git clone ${cloneUrl} ${tmpDir}`, { stdio: 'inherit' });
      console.log('✓ Repositorio clonado');
      console.log('');

      // Configure git
      execSync('git config user.name "DevOps Agent R2D2"', { cwd: tmpDir });
      execSync('git config user.email "devops-agent@example.com"', { cwd: tmpDir });

      // Create README.md
      console.log('📄 Creando README.md...');
      fs.writeFileSync(path.join(tmpDir, 'README.md'), readmeContent);
      console.log('   ✓ README.md creado');

      // Create .gitignore
      console.log('📄 Creando .gitignore...');
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), gitignoreContent);
      console.log('   ✓ .gitignore creado');

      // Create all project files
      console.log(`📦 Creando ${Object.keys(projectFiles).length} archivos del proyecto...`);
      for (const [filePath, content] of Object.entries(projectFiles)) {
        const fullPath = path.join(tmpDir, filePath);
        const dir = path.dirname(fullPath);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`   📁 Directorio creado: ${path.relative(tmpDir, dir)}`);
        }
        
        fs.writeFileSync(fullPath, content);
        console.log(`   ✓ ${filePath} (${content.length} bytes)`);
      }
      console.log('');

      // Git add, commit and push
      console.log('📤 Haciendo commit y push...');
      execSync('git add .', { cwd: tmpDir });
      execSync('git commit -m "Initial commit: Add project files"', { cwd: tmpDir, stdio: 'inherit' });
      execSync('git push origin main', { cwd: tmpDir, stdio: 'inherit' });
      console.log('✓ Cambios enviados a GitHub');
      console.log('');

      // Clean up
      console.log('🧹 Limpiando directorio temporal...');
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log('✓ Directorio temporal eliminado');
      console.log('');
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      throw error;
    }

    // Success!
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Deployment completed successfully');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Repository: ${result.repo.html_url}`);
    console.log(`Clone URL: ${result.repo.clone_url}`);
    console.log('');
    
    // Force flush stdout before exiting (K8s buffering issue)
    if (process.stdout.write('')) {
      process.exit(0);
    } else {
      process.stdout.once('drain', () => process.exit(0));
    }
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ Deployment failed');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('');
    
    // Force flush stderr before exiting
    if (process.stderr.write('')) {
      process.exit(1);
    } else {
      process.stderr.once('drain', () => process.exit(1));
    }
  }
}

main();
