import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { toNodeHandler } from 'better-auth/node';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import apiRouter from './routes';
import { swaggerSpec } from './lib/swagger';
import { auth } from './auth';
import { config } from './config';

const app: express.Application = express();

app.use(helmet({
  // Allow Swagger UI to load its own scripts and styles
  contentSecurityPolicy: config.isProduction ? undefined : false,
}));
app.use(
  cors({
    origin: config.trustedOrigins,
    credentials: true,
  }),
);
app.use(compression());

// Auth handler must be registered before express.json() — Better Auth parses its own body
app.all('/api/auth/*', toNodeHandler(auth));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── API Docs ──────────────────────────────────────────────────────────────────
// Interactive Swagger UI  →  GET /api/docs
// Raw OpenAPI JSON spec   →  GET /api/docs.json
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'WB App API Docs',
    customCss: `
      .swagger-ui .topbar { background-color: #1e293b; }
      .swagger-ui .topbar .topbar-wrapper a span { display: none; }
      .swagger-ui .topbar .topbar-wrapper::before {
        content: 'WB App API';
        color: #f8fafc;
        font-size: 1.2rem;
        font-weight: 700;
      }
    `,
    swaggerOptions: {
      persistAuthorization: true,   // Remember Bearer token across page reloads
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  }),
);

app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/v1', healthRouter);
app.use('/api/v1', apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
