export interface DeployRequest {
  // Identificación del proyecto
  name: string;
  repoOwner: string;
  repoSlug?: string;  // Default: name
  
  // Configuración del deployment
  type?: 'front' | 'back';  // Default: 'front'
  branch?: string;     // Default: 'main'
  path?: string;       // Default: 'k8s'
  environment?: string;  // dev, staging, prod
  
  // Configuración de la app
  domain?: string;
  port?: number;
  image?: string;
  
  // Opciones del repositorio
  private?: boolean;  // Default: true
  description?: string;
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
