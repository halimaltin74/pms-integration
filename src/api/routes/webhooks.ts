/**
 * Webhook ingestion routes.
 *
 * POST /webhooks/:pms
 *   Verifies signature, parses to canonical WebhookEvent, returns 200.
 *   Consumers can attach listeners via the emitter exported below.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { PMSSource } from '../../types/canonical';
import { WebhookRouter } from '../../webhooks/router';
import { WebhookEvent } from '../../webhooks/types';
import { logger } from '../../utils';

const PMS_SOURCES = new Set<PMSSource>(['mews', 'cloudbeds', 'opera', 'hotelrunner', 'electro']);

/** Emits 'event' with a WebhookEvent payload for every successfully parsed webhook. */
export const webhookEmitter = new EventEmitter();

export function createWebhookRoutes(webhookRouter: WebhookRouter): Router {
  const router = Router();

  // Must receive raw body — ensure server is configured with express.raw() for this path
  router.post('/:pms', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pms } = req.params as { pms: string };

      if (!PMS_SOURCES.has(pms as PMSSource)) {
        res.status(400).json({ error: 'Unknown PMS source', pms });
        return;
      }

      const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
      const headers = req.headers as Record<string, string | string[] | undefined>;

      const result = webhookRouter.handle(pms as PMSSource, rawBody, headers);

      if (!result.signatureValid) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }

      if (result.ignored) {
        logger.warn(`Webhook ignored for ${pms}: ${result.ignoreReason ?? 'unknown reason'}`);
        res.status(200).json({ ok: true, ignored: true, reason: result.ignoreReason });
        return;
      }

      if (result.event) {
        webhookEmitter.emit('event', result.event as WebhookEvent);
      }

      res.status(200).json({ ok: true, eventId: result.event?.id ?? null });
    } catch (err) { next(err); }
  });

  return router;
}
