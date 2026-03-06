import { Request, Response, NextFunction } from 'express';

/**
 * Simple static API-key middleware.
 * Reads the key from the `X-Api-Key` header and compares it to the
 * configured secret (constant-time safe).
 *
 * If `ALLOWED_API_KEYS` env var is set (comma-separated), all listed keys
 * are accepted. Otherwise falls back to `API_KEY` env var.
 * If neither is set, the middleware is a no-op (open access — dev mode).
 */

import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

const allowedKeys: string[] = (() => {
  const multi = process.env['ALLOWED_API_KEYS'];
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env['API_KEY'];
  if (single) return [single];
  return [];
})();

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (allowedKeys.length === 0) { next(); return; } // dev mode — no auth

  const provided = req.headers['x-api-key'] as string | undefined;
  if (!provided) {
    res.status(401).json({ error: 'Missing X-Api-Key header' });
    return;
  }

  const valid = allowedKeys.some(k => safeEqual(k, provided));
  if (!valid) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
