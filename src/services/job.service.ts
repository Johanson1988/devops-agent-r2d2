import { spawn, ChildProcess } from 'child_process';
import { Job, DeployRequest } from '../types/job.types';
import { getEnvironment } from '../utils/environment';
import { deployQueue } from './deploy-queue.service';
import { config } from '../config';

class JobService {
  private localProcesses: Map<string, ChildProcess> = new Map();
  
  constructor() {
    // Setup handler for processing next job in queue
    deployQueue.setNextJobHandler((job) => {
      const env = getEnvironment();
      if (env === 'kubernetes') {
        this.executeKubernetesJob(job);
      } else {
        this.executeLocalJob(job);
      }
    });
  }

  /**
   * Create and execute a deployment job
   */
  async createDeployJob(request: DeployRequest): Promise<Job> {
    const jobId = this.generateJobId();
    const job: Job = {
      id: jobId,
      request,
      status: 'pending',
      startTime: new Date(),
      logs: [],
    };

    // Add to queue
    const position = deployQueue.addJob(job);

    // If queue was empty, start processing immediately
    if (position === 1) {
      deployQueue.startProcessing();
    } else {
      // Job is queued
      deployQueue.updateJobLogs(job.id, `[${new Date().toISOString()}] Job queued at position ${position}`);
    }

    return job;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Job | undefined {
    return deployQueue.getJob(jobId);
  }

  /**
   * Stream job logs (for SSE or WebSocket)
   */
  async streamJobLogs(jobId: string, onLog: (log: string) => void): Promise<void> {
    const job = deployQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Send existing logs
    job.logs.forEach(log => onLog(log));

    // If job is still running, continue streaming
    if (job.status === 'running') {
      // Poll for new logs every 500ms
      const interval = setInterval(() => {
        const currentJob = deployQueue.getJob(jobId);
        if (!currentJob || currentJob.status !== 'running') {
          clearInterval(interval);
          return;
        }
        
        // Send new logs (simplified - in production use proper log tailing)
        const newLogs = currentJob.logs.slice(job.logs.length);
        newLogs.forEach(log => onLog(log));
      }, 500);
    }
  }

  /**
   * Execute job locally using child process
   */
  private async executeLocalJob(job: Job): Promise<void> {
    deployQueue.updateJobLogs(job.id, `[${new Date().toISOString()}] Starting local deployment...`);
    deployQueue.updateJobLogs(job.id, `Job ID: ${job.id}`);
    deployQueue.updateJobLogs(job.id, `Request: ${JSON.stringify(job.request)}`);

    try {
      // For now, simulate the worker
      // In next phase, we'll call: node dist/workers/deploy-worker.js
      const workerProcess = spawn('node', [
        '-e',
        `
        console.log('Worker started');
        console.log('Processing deploy request: ${job.request.name}');
        setTimeout(() => {
          console.log('Deploy completed successfully');
          process.exit(0);
        }, 5000);
        `
      ]);

      this.localProcesses.set(job.id, workerProcess);

      // Capture stdout
      workerProcess.stdout.on('data', (data) => {
        const log = data.toString().trim();
        deployQueue.updateJobLogs(job.id, `[STDOUT] ${log}`);
      });

      // Capture stderr
      workerProcess.stderr.on('data', (data) => {
        const log = data.toString().trim();
        deployQueue.updateJobLogs(job.id, `[STDERR] ${log}`);
      });

      // Handle completion
      workerProcess.on('close', (code) => {
        this.localProcesses.delete(job.id);
        
        if (code === 0) {
          deployQueue.updateJobLogs(job.id, `[${new Date().toISOString()}] Deployment succeeded`);
          deployQueue.completeJob(job.id, true);
        } else {
          deployQueue.updateJobLogs(job.id, `[${new Date().toISOString()}] Deployment failed with code ${code}`);
          deployQueue.completeJob(job.id, false, `Process exited with code ${code}`);
        }
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        if (this.localProcesses.has(job.id)) {
          workerProcess.kill();
          deployQueue.updateJobLogs(job.id, `[${new Date().toISOString()}] Deployment timed out after 10 minutes`);
          deployQueue.completeJob(job.id, false, 'Timeout');
        }
      }, 10 * 60 * 1000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      deployQueue.updateJobLogs(job.id, `[ERROR] ${errorMsg}`);
      deployQueue.completeJob(job.id, false, errorMsg);
    }
  }

  /**
   * Execute job in Kubernetes (to be implemented)
   */
  private async executeKubernetesJob(job: Job): Promise<void> {
    // TODO: Implement Kubernetes Job creation in next phase
    deployQueue.updateJobLogs(job.id, '[K8s] Kubernetes job execution not yet implemented');
    deployQueue.updateJobLogs(job.id, '[K8s] Falling back to local execution for now');
    
    await this.executeLocalJob(job);
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `deploy-${timestamp}-${random}`;
  }
}

export const jobService = new JobService();
