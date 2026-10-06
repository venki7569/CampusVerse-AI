import { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { sendSuccess } from '../../utils/apiResponse';
import { getLivenessReport, getReadinessReport } from './health.service';
import { getConfigDiagnostics } from '../../config/config-diagnostics';

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     summary: Liveness probe
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API process is alive
 */
export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, getLivenessReport(), { service: 'campusverse-api', probe: 'liveness' });
}

/**
 * @openapi
 * /api/v1/health/config:
 *   get:
 *     summary: Configuration diagnostics (no secrets)
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Safe configuration summary
 */
export function getConfigDiagnosticsHandler(_req: Request, res: Response): void {
  sendSuccess(res, getConfigDiagnostics(), { service: 'campusverse-api', probe: 'config' });
}

/**
 * @openapi
 * /api/v1/health/ready:
 *   get:
 *     summary: Readiness probe with dependency checks
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is ready or degraded but serving
 *       503:
 *         description: Service is not ready
 */
export function createReadinessHandler(db: PrismaClient) {
  return async (_req: Request, res: Response): Promise<void> => {
    const report = await getReadinessReport(db);
    const statusCode = report.status === 'not_ready' ? 503 : 200;
    sendSuccess(res, report, { service: 'campusverse-api', probe: 'readiness' }, statusCode);
  };
}
