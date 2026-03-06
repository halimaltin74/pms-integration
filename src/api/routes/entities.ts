/**
 * Entity fetch routes.
 *
 * GET /entities/:pms/:entity
 *   Query params: propertyId (required), startDate, endDate, limit, cursor
 *
 * Fetches live data from the PMS using stored credentials and returns
 * normalised canonical entities.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PMSSource } from '../../types/canonical';
import { EntityType } from '../../parser';
import { CredentialStore } from '../../credentials/store';
import { fetchFromStore } from '../../fetcher';
import { FetchOptions } from '../../credentials/types';

const PMS_SOURCES = new Set<PMSSource>(['mews', 'cloudbeds', 'opera', 'hotelrunner', 'electro']);
const ENTITY_TYPES = new Set<EntityType>([
  'roomTypes', 'properties', 'reservations', 'rates',
  'availability', 'guests', 'folios', 'housekeeping',
]);

export function createEntityRoutes(store: CredentialStore): Router {
  const router = Router();

  router.get('/:pms/:entity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pms, entity } = req.params as { pms: string; entity: string };

      if (!PMS_SOURCES.has(pms as PMSSource)) {
        res.status(400).json({ error: 'Unknown PMS source', pms });
        return;
      }
      if (!ENTITY_TYPES.has(entity as EntityType)) {
        res.status(400).json({ error: 'Unknown entity type', entity });
        return;
      }

      const { propertyId, startDate, endDate, limit, cursor } = req.query as Record<string, string | undefined>;
      if (!propertyId) {
        res.status(400).json({ error: 'propertyId query param is required' });
        return;
      }

      const options: FetchOptions = {
        ...(startDate && { startDate }),
        ...(endDate   && { endDate }),
        ...(limit     && { limit: Number(limit) }),
        ...(cursor    && { cursor }),
      };

      const data = await fetchFromStore(pms as PMSSource, entity as EntityType, propertyId, store, options);
      res.json({ pmsSource: pms, entity, count: data.length, data });
    } catch (err) { next(err); }
  });

  return router;
}
