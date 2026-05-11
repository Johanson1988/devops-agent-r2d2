import { GitHubService } from './src/services/github.service';
const svc = new GitHubService();
svc.createRepoSecret('Johanson1988', 'bbdd-agent', 'INFRA_PAT', process.env.GITHUB_TOKEN!)
  .then(() => { console.log('OK - INFRA_PAT created'); process.exit(0); })
  .catch((e: any) => { console.error('ERROR:', e.message); process.exit(1); });
