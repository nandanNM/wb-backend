# VPS Multi-Project Production Setup Guide

A step-by-step guide for running multiple Node.js backend projects on a single VPS with Neon (PostgreSQL), PM2, Nginx, and monitoring.

---

## Prerequisites

- VPS with Ubuntu 22.04+ (2 vCPU, 4GB RAM minimum)
- A domain name with DNS A records pointing to your VPS IP
- SSH access to the VPS
- Neon account with projects created per app
- GitHub repository with your apps

---

## Step 1 — Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create a non-root deploy user
sudo adduser deploy
sudo usermod -aG sudo deploy

# Copy your SSH key to the deploy user
sudo rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Switch to deploy user for remaining steps
su - deploy
```

---

## Step 2 — Install Node.js via NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install --lts
nvm use --lts
node -v   # verify
```

---

## Step 3 — Install PM2

```bash
npm install -g pm2

# Verify install
pm2 -v
```

---

## Step 4 — Install pnpm (if your projects use it)

```bash
npm install -g pnpm
```

---

## Step 5 — Configure UFW Firewall

```bash
sudo apt install ufw -y

sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# Never expose app ports directly
sudo ufw deny 3001
sudo ufw deny 3002
sudo ufw deny 3003

sudo ufw enable
sudo ufw status
```

---

## Step 6 — Install Caddy (Reverse Proxy + Auto SSL)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy -y
```

Configure your sites — edit `/etc/caddy/Caddyfile`:

```
api.yourdomain.com {
    reverse_proxy localhost:3001
}

other.yourdomain.com {
    reverse_proxy localhost:3002

    # Block metrics from public access
    @metrics path /metrics
    respond @metrics 403
}
```

```bash
sudo systemctl reload caddy
sudo systemctl enable caddy
```

> Caddy automatically provisions and renews Let's Encrypt SSL certificates — no manual Certbot needed.

---

## Step 7 — Deploy Your Apps

Create deployment directories:

```bash
sudo mkdir -p /var/www/wb-backend
sudo mkdir -p /var/www/other-api
sudo chown -R deploy:deploy /var/www
```

Clone your repositories:

```bash
cd /var/www/wb-backend
git clone https://github.com/your-username/wb-backend.git .

cd /var/www/other-api
git clone https://github.com/your-username/other-api.git .
```

Install dependencies and build:

```bash
cd /var/www/wb-backend
pnpm install --frozen-lockfile
pnpm build

cd /var/www/other-api
pnpm install --frozen-lockfile
pnpm build
```

---

## Step 8 — Environment Variables

Create `.env.production` for each app. **Never commit this file.**

**`/var/www/wb-backend/.env.production`**
```env
NODE_ENV=production
PORT=3001
SERVICE_NAME=wb-backend

# Use the pooled connection string from Neon dashboard (toggle "Connection pooling" ON)
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/wb_backend?sslmode=require

# Add your other secrets here
JWT_SECRET=your_jwt_secret
BETTER_AUTH_SECRET=your_auth_secret
```

**`/var/www/other-api/.env.production`**
```env
NODE_ENV=production
PORT=3002
SERVICE_NAME=other-api
DATABASE_URL=postgresql://user:pass@ep-yyy-pooler.us-east-2.aws.neon.tech/other_api?sslmode=require
```

Secure the files:
```bash
chmod 600 /var/www/wb-backend/.env.production
chmod 600 /var/www/other-api/.env.production
```

---

## Step 9 — PM2 Ecosystem Config

Create `/var/www/ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'wb-backend',
      script: 'dist/index.js',
      cwd: '/var/www/wb-backend',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      out_file: '/var/log/pm2/wb-backend-out.log',
      error_file: '/var/log/pm2/wb-backend-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'other-api',
      script: 'dist/index.js',
      cwd: '/var/www/other-api',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      out_file: '/var/log/pm2/other-api-out.log',
      error_file: '/var/log/pm2/other-api-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
```

Create log directory and start all apps:

```bash
sudo mkdir -p /var/log/pm2
sudo chown -R deploy:deploy /var/log/pm2

# Load env vars and start
cd /var/www
export $(cat /var/www/wb-backend/.env.production | grep -v '#' | xargs)
pm2 start ecosystem.config.js --env production

# Save process list and enable auto-start on reboot
pm2 save
pm2 startup
# Run the command PM2 outputs from `pm2 startup`
```

---

## Step 10 — Neon Connection with Drizzle ORM

Install the Neon serverless driver in each app:

```bash
pnpm add @neondatabase/serverless drizzle-orm
```

**`src/db/index.ts`** — for simple queries:
```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**`src/db/index.ts`** — if you need transactions:
```ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });
```

> Always use the **pooled** connection string from Neon (`-pooler` in hostname) in production. PM2 cluster mode spawns multiple processes — without pooling you'll exhaust Neon's connection limit.

---

## Step 11 — Structured Logging with Pino

```bash
pnpm add pino pino-http
pnpm add -D pino-pretty
```

**`src/lib/logger.ts`**
```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: process.env.SERVICE_NAME,
    env: process.env.NODE_ENV,
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty' },
  }),
});
```

**`src/app.ts`**
```ts
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';

app.use(pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));
```

---

## Step 12 — Metrics with prom-client

```bash
pnpm add prom-client
```

**`src/lib/metrics.ts`**
```ts
import { collectDefaultMetrics, Registry, Histogram, Counter } from 'prom-client';

export const register = new Registry();
collectDefaultMetrics({ register });

export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});
```

Expose the metrics endpoint in your router:
```ts
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

The `/metrics` route is blocked from public access by Caddy's config in Step 6.

---

## Step 13 — Monitoring Stack (Prometheus + Grafana)

Create `/var/www/monitoring/docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "127.0.0.1:9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=change_this_password
      - GF_SECURITY_ADMIN_USER=admin
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "127.0.0.1:4000:3000"
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    ports:
      - "127.0.0.1:3100:3100"
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log/pm2:/var/log/pm2:ro
      - ./promtail.yml:/etc/promtail/config.yml
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

**`/var/www/monitoring/prometheus.yml`**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: wb-backend
    static_configs:
      - targets: ['host.docker.internal:3001']
    metrics_path: /metrics

  - job_name: other-api
    static_configs:
      - targets: ['host.docker.internal:3002']
    metrics_path: /metrics
```

**`/var/www/monitoring/promtail.yml`**
```yaml
clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: pm2-logs
    static_configs:
      - targets: [localhost]
        labels:
          job: pm2
          __path__: /var/log/pm2/*.log
```

Expose Grafana via Caddy:

```
grafana.yourdomain.com {
    reverse_proxy localhost:4000
}
```

```bash
cd /var/www/monitoring
docker compose up -d
```

---

## Step 14 — GitHub Actions CI/CD

**`.github/workflows/deploy.yml`** for each repository:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/wb-backend
            git pull origin main
            pnpm install --frozen-lockfile
            pnpm build
            pm2 reload wb-backend --update-env
```

Add these secrets in GitHub → Settings → Secrets:
- `VPS_HOST` — your VPS IP address
- `VPS_USER` — `deploy`
- `VPS_SSH_KEY` — contents of `~/.ssh/id_rsa` (private key)

---

## Step 15 — Neon Branching for Staging (Optional)

```bash
# Install Neon CLI
npm install -g neonctl

# Authenticate
neonctl auth

# Create a staging branch from main (zero data copy)
neonctl branches create --name staging --project-id your-project-id

# Get staging connection string
neonctl connection-string --branch staging
```

Map your environments:

| Branch | Environment | DATABASE_URL |
|---|---|---|
| `main` | Production | Neon main branch (pooled) |
| `staging` | Staging VPS | Neon staging branch (pooled) |
| `dev` | Local | Neon dev branch or local Postgres |

---

## Common PM2 Commands

```bash
pm2 list                        # list all running apps
pm2 logs wb-backend             # stream logs
pm2 logs wb-backend --lines 100 # last 100 lines
pm2 reload wb-backend           # zero-downtime restart
pm2 restart wb-backend          # full restart
pm2 stop wb-backend             # stop app
pm2 delete wb-backend           # remove from PM2
pm2 monit                       # live CPU/mem dashboard in terminal
```

---

## Deployment Checklist

- [ ] Non-root `deploy` user created
- [ ] UFW enabled, only ports 22/80/443 open
- [ ] Caddy running with HTTPS auto-provisioned
- [ ] `.env.production` files created and `chmod 600`
- [ ] Neon pooled connection strings used in DATABASE_URL
- [ ] PM2 started with `--env production`, saved, and startup enabled
- [ ] Pino logging wired up in each app
- [ ] `/metrics` endpoint blocked from public access
- [ ] Monitoring stack running (Prometheus + Grafana + Loki)
- [ ] GitHub Actions secrets set and deploy workflow tested
- [ ] `pm2 reload` (not restart) used in deploy scripts for zero downtime
