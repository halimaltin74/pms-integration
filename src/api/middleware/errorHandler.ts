import { Request, Response, NextFunction } from 'express';
import { PMSApiError } from '../../errors';
import { logger } from '../../utils';

const ERROR_CODE_STATUS: Record<string, number> = {
  AUTH_FAILED:          401,
  TOKEN_REFRESH_FAILED: 401,
  NOT_FOUND:            404,
  RATE_LIMITED:         429,
  SERVER_ERROR:         502,
  NETWORK_ERROR:        503,
  INVALID_RESPONSE:     502,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof PMSApiError) {
    const status = err.statusCode ?? ERROR_CODE_STATUS[err.code] ?? 500;
    logger.error(`[API] PMSApiError ${err.code} from ${err.pmsSource}`, err.message);
    res.status(status).json({
      error: err.code,
      pmsSource: err.pmsSource,
      message: err.message,
    });
    return;
  }

  logger.error('[API] Unhandled error', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
}
