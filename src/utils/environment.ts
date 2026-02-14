import fs from 'fs';

/**
 * Detect if running inside Kubernetes cluster
 */
export function isInKubernetes(): boolean {
  return fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount');
}

/**
 * Get environment type
 */
export function getEnvironment(): 'kubernetes' | 'local' {
  return isInKubernetes() ? 'kubernetes' : 'local';
}
