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
/** 기본 N=2^15 · r=8은 약 32MiB를 쓴다 — Node 기본 maxmem(32MiB)을 살짝 넘어 여유를 준다 */
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

/**
 * OpenSSL scrypt가 잡는 메모리(B = 128·r·p, V = 128·r·(N+2)). 이 값이 maxmem을 넘거나 N이 2의 거듭제곱이
 * 아니면 `scrypt`가 throw한다 — 해시를 읽을 때 걸러야 로그인이 500 대신 401로 끝난다.
 */
function scryptMemoryBytes({ N, r, p }: ScryptParams): number {
  return 128 * r * (N + p + 2);
}

function isPowerOfTwo(value: number): boolean {
  return value > 1 && (value & (value - 1)) === 0;
}

function parseHash(hash: string) {
  const [scheme, n, r, p, salt, key, ...rest] = hash.split("$");
  if (scheme !== SCHEME || salt === undefined || key === undefined || rest.length > 0) return null;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Object.values(params).every((value) => Number.isSafeInteger(value) && value > 0))
    return null;
  if (!isPowerOfTwo(params.N) || scryptMemoryBytes(params) > MAX_MEMORY_BYTES) return null;
  // OpenSSL 제약 N < 2^(16·r) — 메모리 한도 안이어도 이것을 어기면 throw한다
  if (params.N >= 2 ** (16 * params.r)) return null;
  const keyBytes = Buffer.from(key, "base64");
  if (keyBytes.length === 0) return null;
  return { params, salt: Buffer.from(salt, "base64"), key: keyBytes };
}

/** 로컬 진입점이 시작할 때 시드 해시를 미리 본다 — 틀린 해시로 떠서 로그인만 영원히 401이 되지 않게 */
export function isValidPasswordHash(hash: string): boolean {
  return parseHash(hash) !== null;
}

/** 모양이 틀린 해시는 어떤 비밀번호와도 맞지 않는다(throw하지 않는다 — 로그인은 401 하나로 끝난다). */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parsed = parseHash(hash);
  if (parsed === null) return false;
  try {
    const candidate = await derive(password, parsed.salt, parsed.key.length, parsed.params);
    return timingSafeEqual(candidate, parsed.key);
  } catch {
    // parseHash가 못 거른 OpenSSL 제약이 남아 있어도 로그인은 500이 아니라 401로 끝난다
    return false;
  }
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
