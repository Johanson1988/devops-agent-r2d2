import * as k8s from '@kubernetes/client-node';
import { config } from '../config';

export class KubernetesService {
  private k8sApi: k8s.CoreV1Api;
  private batchApi: k8s.BatchV1Api;
  private kc: k8s.KubeConfig;
  private namespace: string = 'default';
  private workerImage: string;

  constructor() {
    this.kc = new k8s.KubeConfig();
    
    try {
      // Try in-cluster config first
      this.kc.loadFromCluster();
    } catch {
      // Fallback to default config (for local development)
      this.kc.loadFromDefault();
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);

    // Default worker image from config (used in local dev)
    this.workerImage = config.worker.image;
  }

  /**
   * Resolve the worker image by reading the current pod's image.
   * This ensures worker jobs always use the same image as the API deployment.
   * Must be called after construction (async).
   */
  async resolveWorkerImage(): Promise<void> {
    const podName = process.env.HOSTNAME;
    if (!podName) {
      console.log('[K8s] No HOSTNAME env var, using default worker image:', this.workerImage);
      return;
    }

    try {
      const pod = await this.k8sApi.readNamespacedPod({
        name: podName,
        namespace: this.namespace,
      });
      const containerImage = pod.spec?.containers?.[0]?.image;
      if (containerImage) {
        this.workerImage = containerImage;
        console.log(`[K8s] Worker image resolved from own pod: ${this.workerImage}`);
      } else {
        console.log('[K8s] Could not read container image from pod spec, using default:', this.workerImage);
      }
    } catch (error) {
      console.log('[K8s] Could not resolve own pod image (may be running locally):', this.workerImage);
    }
  }

  /**
   * Create a Kubernetes Job for deployment
   */
  async createDeployJob(
    jobId: string,
    deployRequest: any
  ): Promise<void> {
    const jobName = jobId.toLowerCase().replace(/_/g, '-');
    
    const jobManifest: k8s.V1Job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        namespace: this.namespace,
        labels: {
          app: 'devops-agent-worker',
          jobId: jobId,
          type: 'deploy',
        },
      },
      spec: {
        ttlSecondsAfterFinished: 3600, // Clean up after 1 hour
        backoffLimit: 0, // No retries
        activeDeadlineSeconds: 600, // 10 minute timeout
        template: {
          metadata: {
            labels: {
              app: 'devops-agent-worker',
              jobId: jobId,
            },
          },
          spec: {
            restartPolicy: 'Never',
            containers: [
              {
                name: 'deploy-worker',
                image: this.workerImage,
                imagePullPolicy: 'Always',
                command: ['node', 'dist/workers/deploy-worker.js'],
                args: [JSON.stringify(deployRequest)],
                env: [
                  {
                    name: 'GITHUB_TOKEN',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'devops-agent-secrets',
                        key: 'GITHUB_TOKEN',
                      },
                    },
                  },
                  {
                    name: 'JOB_ID',
                    value: jobId,
                  },
                ],
                resources: {
                  requests: {
                    cpu: '100m',
                    memory: '128Mi',
                  },
                  limits: {
                    cpu: '500m',
                    memory: '512Mi',
                  },
                },
              },
            ],
          },
        },
      },
    };

    await this.batchApi.createNamespacedJob({
      namespace: this.namespace,
      body: jobManifest,
    });
  }

  /**
   * Get Job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    message?: string;
  }> {
    const jobName = jobId.toLowerCase().replace(/_/g, '-');

    try {
      const job = await this.batchApi.readNamespacedJobStatus({
        name: jobName,
        namespace: this.namespace,
      });
      
      if (job.status?.succeeded) {
        return { status: 'succeeded' };
      }
      
      if (job.status?.failed) {
        return { status: 'failed', message: 'Job failed' };
      }
      
      if (job.status?.active) {
        return { status: 'running' };
      }
      
      return { status: 'pending' };
    } catch (error) {
      throw new Error(`Failed to get job status: ${error}`);
    }
  }

  /**
   * Get Pod name for a Job
   */
  async getPodNameForJob(jobId: string): Promise<string | null> {
    const jobName = jobId.toLowerCase().replace(/_/g, '-');
    
    try {
      const pods = await this.k8sApi.listNamespacedPod({
        namespace: this.namespace,
        labelSelector: `job-name=${jobName}`,
      });

      if (pods.items.length > 0) {
        return pods.items[0].metadata?.name || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting pod name:', error);
      return null;
    }
  }

  /**
   * Stream logs from Job's Pod
   */
  async streamPodLogs(
    podName: string,
    onLog: (log: string) => void,
    onComplete: (success: boolean) => void
  ): Promise<void> {
    try {
      const logStream = new k8s.Log(this.kc);
      const stream = require('stream');
      const passThrough = new stream.PassThrough();
      
      passThrough.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        lines.forEach((line: string) => onLog(line));
      });

      passThrough.on('error', (err: Error) => {
        console.error('Log stream error:', err);
        this.waitForPodCompletion(podName, onComplete);
      });

      passThrough.on('end', async () => {
        // Wait for pod to reach final state
        this.waitForPodCompletion(podName, onComplete);
      });
      
      await logStream.log(
        this.namespace,
        podName,
        '',
        passThrough,
        { follow: true, pretty: false, timestamps: false }
      );

    } catch (error) {
      console.error('Error streaming logs:', error);
      this.waitForPodCompletion(podName, onComplete);
    }
  }

  /**
   * Wait for pod to reach final state (Succeeded or Failed)
   */
  private async waitForPodCompletion(
    podName: string,
    onComplete: (success: boolean) => void,
    maxAttempts: number = 10,
    delayMs: number = 1000
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const pod = await this.k8sApi.readNamespacedPodStatus({
          name: podName,
          namespace: this.namespace,
        });
        
        const phase = pod.status?.phase;
        
        if (phase === 'Succeeded') {
          onComplete(true);
          return;
        }
        
        if (phase === 'Failed') {
          onComplete(false);
          return;
        }
        
        // Still running, wait before next check
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
      } catch (error) {
        console.error('Error checking pod status:', error);
        if (i === maxAttempts - 1) {
          onComplete(false);
          return;
        }
      }
    }
    
    // Timeout - assume failure
    console.error(`Pod ${podName} did not reach final state after ${maxAttempts} attempts`);
    onComplete(false);
  }

  /**
   * Delete Job (cleanup)
   */
  async deleteJob(jobId: string): Promise<void> {
    const jobName = jobId.toLowerCase().replace(/_/g, '-');
    
    try {
      await this.batchApi.deleteNamespacedJob({
        name: jobName,
        namespace: this.namespace,
        propagationPolicy: 'Background',
      });
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  }

  /**
   * Check if running in Kubernetes
   */
  isInCluster(): boolean {
    try {
      const testKc = new k8s.KubeConfig();
      testKc.loadFromCluster();
      return true;
    } catch {
      return false;
    }
  }
}

export const k8sService = new KubernetesService();
