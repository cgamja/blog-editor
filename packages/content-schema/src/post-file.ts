import { z } from "zod";
import { SCHEMA_VERSION, createPostMetaSchema } from "./meta";
import { docSchema } from "./doc";

/**
 * 저장 단위(plan 3-4). slug는 파일 안에 없다 — 저장 경로
 * `workspaces/<id>/posts/<slug>.json`의 키라 기존 slugSchema가 검증한다.
 * 카테고리는 워크스페이스 설정이 주므로 메타와 같이 팩토리다(spec: post-file).
 */
export function createPostFileSchema(options: { categories: readonly [string, ...string[]] }) {
  return z.strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    meta: createPostMetaSchema(options),
    doc: docSchema,
  });
}

/** 스키마가 팩토리라 타입도 팩토리의 반환값에서 뽑는다. */
export type PostFile = z.infer<ReturnType<typeof createPostFileSchema>>;

/**
 * migrations[i]는 버전 i+1을 i+2로 올린다. 지금 SCHEMA_VERSION은 1이므로 빈 배열이 곧 맞는 값이다
 * — 이 배열 자체는 "기능"이 아니라 "아직 버전을 올린 적 없다"는 사실이라 스텁이 아니라 실값이다.
 */
export const migrations: ReadonlyArray<(file: unknown) => unknown> = [];

/**
 * migrate가 미래 버전 · 버전 없음 · 버전 형식 오류에서 던지는 에러(spec: post-file).
 * 메시지는 String()으로 만든다 — JSON.stringify는 BigInt에서 TypeError를 던져 오류 계약을 깬다.
 */
export class MigrationError extends Error {
  constructor(received: unknown) {
    super(`migrate: 지원하지 않는 schemaVersion — 받은 값: ${String(received)}`);
    this.name = "MigrationError";
  }
}

/** raw가 일반 객체일 때만 schemaVersion을 읽는다 — 배열·null·원시값은 버전이 없는 것으로 본다. */
function readSchemaVersion(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  return (raw as Record<string, unknown>).schemaVersion;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * JSON-safe한 PostFile 형태를 깊이 복제한다 — 입력을 절대 변형하지 않기 위해서다.
 * 이 패키지엔 DOM/node 전역 타입이 없어 structuredClone 대신 JSON 왕복을 쓴다
 * (post-file.test.ts의 deepClone과 같은 전략).
 */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * raw.schemaVersion부터 SCHEMA_VERSION까지 migrations를 순서대로 적용한다.
 * 검증은 하지 않는다 — 호출자가 결과를 createPostFileSchema로 파싱한다(spec: post-file).
 */
export function migrate(raw: unknown): unknown {
  const version = readSchemaVersion(raw);
  if (!isPositiveInteger(version) || version > SCHEMA_VERSION) {
    throw new MigrationError(version);
  }

  let result = deepCopy(raw);
  for (let current = version; current < SCHEMA_VERSION; current += 1) {
    // current < SCHEMA_VERSION과 migrations.length === SCHEMA_VERSION - 1(불변식) 덕에
    // current - 1은 항상 유효한 인덱스다 — noUncheckedIndexedAccess 때문에 단언이 필요하다.
    const step = migrations[current - 1]!;
    result = step(result);
  }
  return result;
}
