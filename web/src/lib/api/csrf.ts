import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Double-submit CSRF token bound to the signed-in user, plus an Origin check (security-spec §8).
export const CSRF_COOKIE = "vnr_csrf";
export const CSRF_HEADER = "x-csrf-token";

function sign(secret: string, subject: string, nonce: string) {
  return createHmac("sha256", secret).update(`csrf:${subject}:${nonce}`).digest("base64url");
}

export function issueCsrfToken(secret: string, subject: string): string {
  const nonce = randomBytes(18).toString("base64url");
  return `${nonce}.${sign(secret, subject, nonce)}`;
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyCsrfToken(secret: string, subject: string, headerToken: string | null, cookieToken: string | undefined): boolean {
  if (!headerToken || !cookieToken || !equal(headerToken, cookieToken)) return false;
  const [nonce, signature] = headerToken.split(".");
  return Boolean(nonce && signature) && equal(signature, sign(secret, subject, nonce));
}

export function isSameOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const own = new URL(request.url).origin;
  return origin === own || allowedOrigins.includes(origin);
}
