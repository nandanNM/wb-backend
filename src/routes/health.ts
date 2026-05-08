/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns service status, uptime, and environment. Does NOT require authentication.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:      { type: string, example: ok }
 *                 timestamp:   { type: string, format: date-time }
 *                 uptime:      { type: integer, example: 3600, description: Seconds since start }
 *                 environment: { type: string, example: production }
 *                 version:     { type: string, example: 1.0.0 }
 *
 * /metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Exposes default Node.js + process metrics in Prometheus text format. Does NOT require authentication.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Prometheus metrics text
 *         content:
 *           text/plain:
 *             schema: { type: string }
 */

import { Router, Request, Response } from 'express';
import { collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'wb_' });

const router: Router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV ?? 'development',
    version: process.env.npm_package_version ?? '0.0.0',
  });
});

router.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
