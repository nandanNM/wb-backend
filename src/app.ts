import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import { auth } from './auth';
import { config } from './config';

const app: express.Application = express();

app.use(helmet());
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

app.use('/api/v1', healthRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
