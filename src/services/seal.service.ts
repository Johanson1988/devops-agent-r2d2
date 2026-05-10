/**
 * SealService — wraps kubeseal CLI to encrypt secrets in-cluster.
 *
 * Workflow:
 * 1. Build a clean Secret manifest YAML with target ns + name + data + (optional) annotations
 * 2. Pipe through `kubeseal --controller-name=... --controller-namespace=... --format yaml`
 * 3. Return SealedSecret YAML string
 *
 * Requires kubeseal binary available on PATH (installed in Dockerfile).
 * Talks to sealed-secrets-controller in kube-system to fetch the public cert.
 */

import { spawn } from 'child_process';
import * as yaml from 'js-yaml';

export interface SealSecretInput {
  namespace: string;
  name: string;
  data: Record<string, string>; // plain string values, not base64
  type?: string; // default: Opaque
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

export class SealService {
  private controllerName: string;
  private controllerNamespace: string;

  constructor(opts?: { controllerName?: string; controllerNamespace?: string }) {
    this.controllerName = opts?.controllerName || 'sealed-secrets-controller';
    this.controllerNamespace = opts?.controllerNamespace || 'kube-system';
  }

  /**
   * Encrypt a secret. Returns SealedSecret YAML string ready to commit/apply.
   */
  async seal(input: SealSecretInput): Promise<string> {
    if (!input.namespace || !input.name) {
      throw new Error('seal: namespace and name are required');
    }

    // Build plain Secret manifest (data values base64-encoded as K8s expects)
    const dataB64: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.data || {})) {
      dataB64[k] = Buffer.from(v, 'utf-8').toString('base64');
    }

    const metadata: Record<string, unknown> = {
      name: input.name,
      namespace: input.namespace,
    };
    if (input.annotations) metadata.annotations = input.annotations;
    if (input.labels) metadata.labels = input.labels;

    const secretManifest = yaml.dump({
      apiVersion: 'v1',
      kind: 'Secret',
      metadata,
      type: input.type || 'Opaque',
      data: dataB64,
    });

    return await this.runKubeseal(secretManifest, input.namespace);
  }

  /**
   * Run kubeseal CLI with the secret manifest piped via stdin.
   */
  private runKubeseal(secretYaml: string, namespace: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '--controller-name', this.controllerName,
        '--controller-namespace', this.controllerNamespace,
        '--format', 'yaml',
        '-n', namespace,
      ];
      const proc = spawn('kubeseal', args);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      proc.on('error', (err) => reject(new Error(`kubeseal spawn failed: ${err.message}`)));
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`kubeseal exited ${code}: ${stderr}`));
        }
      });
      proc.stdin.write(secretYaml);
      proc.stdin.end();
    });
  }
}

export const sealService = new SealService();
