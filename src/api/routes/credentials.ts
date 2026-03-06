/**
 * Credential management routes.
 *
 * POST   /credentials/:pms            — upsert credentials for a property
 * GET    /credentials/:pms/:propertyId — check whether credentials exist
 * DELETE /credentials/:pms/:propertyId — remove credentials
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PMSSource } from '../../types/canonical';
import { CredentialStore } from '../../credentials/store';
import { AnyCredentials } from '../../credentials/types';

const PMS_SOURCES = new Set<PMSSource>(['mews', 'cloudbeds', 'opera', 'hotelrunner', 'electro']);

function assertPMS(source: string): source is PMSSource {
  return PMS_SOURCES.has(source as PMSSource);
}

export function createCredentialRoutes(store: CredentialStore): Router {
  const router = Router();

  // Upsert credentials
  router.post('/:pms', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pms } = req.params as { pms: string };
      if (!assertPMS(pms)) {
        res.status(400).json({ error: 'Unknown PMS source', pms });
        return;
      }

      const body = req.body as Record<string, unknown>;
      if (!body.propertyId) {
        res.status(400).json({ error: 'propertyId is required in request body' });
        return;
      }

      const creds = { ...body, pmsSource: pms, propertyId: String(body.propertyId) } as AnyCredentials & { propertyId: string };
      await store.set(creds);
      res.status(201).json({ ok: true, pmsSource: pms, propertyId: body.propertyId });
    } catch (err) { next(err); }
  });

  // Existence check
  router.get('/:pms/:propertyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pms, propertyId } = req.params as { pms: string; propertyId: string };
      if (!assertPMS(pms)) {
        res.status(400).json({ error: 'Unknown PMS source', pms });
        return;
      }

      const creds = await store.get(pms, propertyId);
      if (!creds) {
        res.status(404).json({ error: 'Credentials not found' });
        return;
      }
      res.json({ ok: true, pmsSource: pms, propertyId });
    } catch (err) { next(err); }
  });

  // Delete credentials
  router.delete('/:pms/:propertyId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pms, propertyId } = req.params as { pms: string; propertyId: string };
      if (!assertPMS(pms)) {
        res.status(400).json({ error: 'Unknown PMS source', pms });
        return;
      }

      await store.delete(pms, propertyId);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  return router;
}
