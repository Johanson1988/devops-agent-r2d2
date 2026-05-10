/**
 * Secret routes — endpoints to seal/rotate secrets via the API.
 *
 * - POST /api/reseal-secret
 *   Body: { namespace, name, data: { KEY: "value", ... }, type?, annotations?, labels? }
 *   Returns: { status: "success", sealedYaml: "<SealedSecret manifest YAML>" }
 *
 *   Cifra los valores con kubeseal (CLI subprocess) talking to
 *   sealed-secrets-controller en kube-system, devuelve el manifest listo
 *   para commitear a infra-live/apps/<app>/secret.sealed.yaml.
 *
 *   NO commitea automáticamente — el caller decide qué hacer con el manifest.
 *   (Future enhancement: opcional flag commitToInfraLive=true que push al repo.)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sealService } from '../services/seal.service';

interface ResealRequest {
  namespace: string;
  name: string;
  data: Record<string, string>;
  type?: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

export async function secretRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: ResealRequest }>(
    '/api/reseal-secret',
    async (request: FastifyRequest<{ Body: ResealRequest }>, reply: FastifyReply) => {
      try {
        const body = request.body;

        if (!body.namespace || !body.name) {
          reply.code(400);
          return {
            status: 'error',
            message: 'Missing required fields: namespace, name',
          };
        }
        if (!body.data || typeof body.data !== 'object' || Object.keys(body.data).length === 0) {
          reply.code(400);
          return {
            status: 'error',
            message: 'Missing or empty required field: data (object of key→value)',
          };
        }

        const sealedYaml = await sealService.seal({
          namespace: body.namespace,
          name: body.name,
          data: body.data,
          type: body.type,
          annotations: body.annotations,
          labels: body.labels,
        });

        return {
          status: 'success',
          message: 'Secret sealed successfully',
          data: {
            namespace: body.namespace,
            name: body.name,
            sealedYaml,
          },
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        fastify.log.error(`reseal-secret failed: ${msg}`);
        reply.code(500);
        return {
          status: 'error',
          message: `Failed to seal secret: ${msg}`,
        };
      }
    }
  );
}
