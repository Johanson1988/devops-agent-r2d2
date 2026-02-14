import * as k8s from '@kubernetes/client-node';
import { config } from '../config';

export class KubernetesService {
  private k8sApi: k8s.CoreV1Api;
  private batchApi: k8s.BatchV1Api;
  private kc: k8s.KubeConfig;
  private namespace: string = 'default';

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
                image: 'devops-agent-r2d2:latest', // TODO: Use actual image with registry
                imagePullPolicy: 'IfNotPresent',
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
        onComplete(false);
      });

      passThrough.on('end', async () => {
        // Check final pod status
        try {
          const pod = await this.k8sApi.readNamespacedPodStatus({
            name: podName,
            namespace: this.namespace,
          });
          const phase = pod.status?.phase;
          onComplete(phase === 'Succeeded');
        } catch {
          onComplete(false);
        }
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
      onComplete(false);
    }
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
