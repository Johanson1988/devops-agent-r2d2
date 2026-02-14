import fs from 'fs';
import { Job } from '../types/job.types';

/**
 * Simple in-memory queue to ensure one deployment at a time
 */
class DeployQueueService {
  private queue: Job[] = [];
  private currentJob: Job | null = null;
  private jobHistory: Map<string, Job> = new Map();

  /**
   * Add job to queue and return position
   */
  addJob(job: Job): number {
    this.queue.push(job);
    this.jobHistory.set(job.id, job);
    
    const position = this.queue.length;
    
    // Don't auto-start here, let the caller handle it
    return position;
  }
  
  /**
   * Start processing the queue
   */
  startProcessing() {
    if (!this.currentJob && this.queue.length > 0) {
      this.processNext();
      if (this.currentJob) {
        this.onNextJobReady?.(this.currentJob);
      }
    }
  }

  /**
   * Mark current job as completed and process next
   */
  completeJob(jobId: string, success: boolean, error?: string) {
    const job = this.jobHistory.get(jobId);
    if (job) {
      job.status = success ? 'succeeded' : 'failed';
      job.endTime = new Date();
      if (error) {
        job.error = error;
      }
    }

    this.currentJob = null;
    
    // Process next job in queue
    this.processNext();
    
    // If there's a next job, trigger its execution
    if (this.currentJob) {
      // Import and execute the next job
      // This will be called by the external JobService
      this.onNextJobReady?.(this.currentJob);
    }
  }
  
  /**
   * Callback for when next job is ready to execute
   */
  private onNextJobReady?: (job: Job) => void;
  
  /**
   * Set callback for next job ready
   */
  setNextJobHandler(handler: (job: Job) => void) {
    this.onNextJobReady = handler;
  }

  /**
   * Update job logs
   */
  updateJobLogs(jobId: string, log: string) {
    const job = this.jobHistory.get(jobId);
    if (job) {
      job.logs.push(log);
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): Job | undefined {
    return this.jobHistory.get(jobId);
  }

  /**
   * Get current queue position for a job
   */
  getQueuePosition(jobId: string): number {
    const index = this.queue.findIndex(j => j.id === jobId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Check if there's a job running
   */
  isRunning(): boolean {
    return this.currentJob !== null;
  }

  /**
   * Process next job in queue
   */
  private processNext() {
    if (this.queue.length > 0) {
      this.currentJob = this.queue.shift()!;
      this.currentJob.status = 'running';
    }
  }
}

export const deployQueue = new DeployQueueService();
