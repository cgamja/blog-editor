/**
 * 비밀번호 해시(plan 3-5 · D8) — `node:crypto` scrypt만 쓴다. 해시 문자열이 파라미터를 들고 다녀서
 * 기본값을 올려도 옛 해시가 계속 검증된다: `scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>`.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

const DEFAULT_PARAMS: ScryptParams = { N: 2 ** 15, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SCHEME = "scrypt";
/** 기본 N=2^15 · r=8은 128·N·r = 32MiB를 쓴다 — Node 기본 maxmem(32MiB)에 딱 걸려 여유를 준다 */
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, keyLength: number, params: ScryptParams) {
  const options: ScryptOptions = { ...params, maxmem: MAX_MEMORY_BYTES };
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, keyLength, options, (error, key) =>
      error === null ? resolve(key) : reject(error),
    );
  });
}

export async function hashPassword(
  password: string,
  params: Partial<ScryptParams> = {},
): Promise<string> {
  const { N, r, p } = { ...DEFAULT_PARAMS, ...params };
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, { N, r, p });
  return [SCHEME, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

function parseHash(hash: string) {
  const [scheme, n, r, p, salt, key] = hash.split("$");
  if (scheme !== SCHEME || salt === undefined || key === undefined) return null;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Object.values(params).every((value) => Number.isInteger(value) && value > 0)) return null;
  return { params, salt: Buffer.from(salt, "base64"), key: Buffer.from(key, "base64") };
}

/** 모양이 틀린 해시는 어떤 비밀번호와도 맞지 않는다(throw하지 않는다 — 로그인은 401 하나로 끝난다). */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parsed = parseHash(hash);
  if (parsed === null || parsed.key.length === 0) return false;
  const candidate = await derive(password, parsed.salt, parsed.key.length, parsed.params);
  return timingSafeEqual(candidate, parsed.key);
}

/**
 * 없는 계정에도 scrypt를 한 번 돌리기 위한 해시(D8 — 계정 유무가 응답 시간으로 드러나지 않게).
 * 기본 파라미터 · 아무 비밀번호와도 맞지 않는 임의 바이트.
 */
export const DUMMY_PASSWORD_HASH = [
  SCHEME,
  DEFAULT_PARAMS.N,
  DEFAULT_PARAMS.r,
  DEFAULT_PARAMS.p,
  Buffer.alloc(SALT_BYTES).toString("base64"),
  Buffer.alloc(KEY_BYTES, 1).toString("base64"),
].join("$");
