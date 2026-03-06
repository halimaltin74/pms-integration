/**
 * Webhook router — maps PMS source → handler.
 *
 * Usage:
 *   const router = createWebhookRouter({ mews: { secret: '...' } });
 *   const result = router.handle('mews', rawBody, headers);
 */

import { PMSSource } from '../types/canonical';
import { WebhookHandler, WebhookHandlerResult } from './types';
import { createMewsWebhookHandler } from './mews.webhook';
import { createCloudbedsWebhookHandler } from './cloudbeds.webhook';
import { createOperaWebhookHandler } from './opera.webhook';
import { createHotelRunnerWebhookHandler } from './hotelrunner.webhook';
import { createElectroWebhookHandler } from './electro.webhook';
import { logger } from '../utils';

export interface WebhookRouterConfig {
  mews?:        { secret?: string };
  cloudbeds?:   { secret?: string };
  opera?:       { webhookToken?: string };
  hotelrunner?: { secret?: string };
  electro?:     { secret?: string };
}

export interface WebhookRouter {
  handle(
    source: PMSSource,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookHandlerResult & { signatureValid: boolean };
}

export function createWebhookRouter(config: WebhookRouterConfig = {}): WebhookRouter {
  const handlers: Partial<Record<PMSSource, WebhookHandler>> = {
    mews:        createMewsWebhookHandler(config.mews?.secret),
    cloudbeds:   createCloudbedsWebhookHandler(config.cloudbeds?.secret),
    opera:       createOperaWebhookHandler(config.opera?.webhookToken),
    hotelrunner: createHotelRunnerWebhookHandler(config.hotelrunner?.secret),
    electro:     createElectroWebhookHandler(config.electro?.secret),
  };

  return {
    handle(source, rawBody, headers) {
      const handler = handlers[source];
      if (!handler) {
        logger.error(`WebhookRouter: no handler for source "${source}"`);
        return { event: null, ignored: true, ignoreReason: `no handler for ${source}`, signatureValid: false };
      }

      const signatureValid = handler.verifySignature(rawBody, headers);
      if (!signatureValid) {
        logger.warn(`WebhookRouter: signature verification failed for ${source}`);
        return { event: null, ignored: true, ignoreReason: 'signature mismatch', signatureValid: false };
      }

      const result = handler.parse(rawBody, headers);
      return { ...result, signatureValid };
    },
  };
}

export type { WebhookEvent, WebhookHandlerResult, WebhookAction } from './types';
