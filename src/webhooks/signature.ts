import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Compute HMAC-SHA256 of `payload` with `secret`.
 * Returns the hex digest.
 */
export function hmacSha256Hex(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Timing-safe comparison of two hex strings (or any two strings).
 * Returns false if lengths differ.
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verify a standard `sha256=<hex>` style signature header.
 *
 * @param secret   HMAC secret key
 * @param payload  Raw request body buffer
 * @param header   Value of the signature header (e.g. "sha256=abc123…")
 * @param prefix   Expected prefix before the hex digest (default "sha256=")
 */
export function verifySha256Header(
  secret: string,
  payload: Buffer,
  header: string | undefined,
  prefix = 'sha256=',
): boolean {
  if (!header) return false;
  const received = header.startsWith(prefix) ? header.slice(prefix.length) : header;
  const expected = hmacSha256Hex(secret, payload);
  return safeCompare(expected, received);
}
