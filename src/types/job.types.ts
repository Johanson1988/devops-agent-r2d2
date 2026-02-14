export interface DeployRequest {
  name: string;
  type?: 'static' | 'node' | 'python';
  repoUrl?: string;
  domain?: string;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  startTime?: string;
  endTime?: string;
  logs?: string;
  error?: string;
}

export interface Job {
  id: string;
  request: DeployRequest;
  status: JobStatus['status'];
  startTime: Date;
  endTime?: Date;
  logs: string[];
  error?: string;
}
