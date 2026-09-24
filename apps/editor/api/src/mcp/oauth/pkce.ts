import { createHash, timingSafeEqual } from "node:crypto";

/** RFC 7636 4.1 — unreserved 문자 43~128자 */
const CODE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
/** S256 challenge는 SHA-256(32바이트)의 base64url이라 항상 43자다 */
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export function isS256Challenge(challenge: string): boolean {
  return S256_CHALLENGE.test(challenge);
}

/** `BASE64URL(SHA256(code_verifier)) == code_challenge` (RFC 7636 4.6) */
export function verifyS256(verifier: string, challenge: string): boolean {
  if (!CODE_VERIFIER.test(verifier) || !isS256Challenge(challenge)) return false;
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  return timingSafeEqual(expected, Buffer.from(challenge));
}
