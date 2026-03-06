/**
 * Express server for the PMS integration layer.
 *
 * Routes:
 *   GET  /health
 *   GET  /entities/:pms/:entity?propertyId=&startDate=&endDate=&limit=
 *   POST /credentials/:pms
 *   GET  /credentials/:pms/:propertyId
 *   DELETE /credentials/:pms/:propertyId
 *   POST /webhooks/:pms
 *
 * Usage:
 *   import { createApp, startServer } from './api/server';
 *   const app = createApp();
 *   startServer(app, 3000);
 */

import express, { Application } from 'express';
import { getDefaultStore } from '../credentials/store';
import { createWebhookRouter, WebhookRouterConfig } from '../webhooks/router';
import { apiKeyMiddleware } from './middleware/apiKey';
import { errorHandler } from './middleware/errorHandler';
import { createEntityRoutes } from './routes/entities';
import { createCredentialRoutes } from './routes/credentials';
import { createWebhookRoutes } from './routes/webhooks';

export interface ServerConfig {
  webhooks?: WebhookRouterConfig;
}

export function createApp(config: ServerConfig = {}): Application {
  const app = express();
  const store = getDefaultStore();

  // Parse JSON for all routes except webhooks (which need raw body)
  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Health check — no auth required
  app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Auth middleware for protected routes
  app.use('/entities', apiKeyMiddleware);
  app.use('/credentials', apiKeyMiddleware);

  // Route handlers
  app.use('/entities', createEntityRoutes(store));
  app.use('/credentials', createCredentialRoutes(store));
  app.use('/webhooks', createWebhookRoutes(createWebhookRouter(config.webhooks)));

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}

export function startServer(app: Application, port = 3000): void {
  app.listen(port, () => {
    console.log(`PMS Integration API listening on port ${port}`);
  });
}

// Allow running directly: `ts-node src/api/server.ts`
if (require.main === module) {
  const webhookConfig: WebhookRouterConfig = {
    mews:        { secret: process.env['MEWS_WEBHOOK_SECRET'] },
    cloudbeds:   { secret: process.env['CLOUDBEDS_WEBHOOK_SECRET'] },
    opera:       { webhookToken: process.env['OPERA_WEBHOOK_TOKEN'] },
    hotelrunner: { secret: process.env['HOTELRUNNER_WEBHOOK_SECRET'] },
    electro:     { secret: process.env['ELECTRO_WEBHOOK_SECRET'] },
  };
  const app = createApp({ webhooks: webhookConfig });
  startServer(app, Number(process.env['PORT'] ?? 3000));
}
