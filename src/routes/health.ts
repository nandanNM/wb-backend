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
