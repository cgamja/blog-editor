import { z } from "zod";
import { SCHEMA_VERSION } from "./meta";
import type { Doc } from "./doc";

/** 저장 단위(plan 3-4) — 실제 필드는 2.2에서 채운다. */
export type PostFile = { schemaVersion: number; meta: unknown; doc: Doc };

function notImplemented(): never {
  throw new Error("createPostFileSchema: 기능 미구현");
}

/**
 * 2.2에서 `{ schemaVersion, meta, doc }` strict 스키마로 교체한다.
 * 지금은 호출부(parse/safeParse)가 항상 던지는 자리표시자 — doc.ts와 같은 이유로
 * zod를 거치지 않고 직접 던진다.
 */
export function createPostFileSchema(options: {
  categories: readonly [string, ...string[]];
}): z.ZodType<PostFile> {
  void options;
  return {
    parse: notImplemented,
    safeParse: notImplemented,
  } as unknown as z.ZodType<PostFile>;
}

/**
 * migrations[i]는 버전 i+1을 i+2로 올린다. 지금 SCHEMA_VERSION은 1이므로 빈 배열이 곧 맞는 값이다
 * — 이 배열 자체는 "기능"이 아니라 "아직 버전을 올린 적 없다"는 사실이라 스텁이 아니라 실값이다.
 */
export const migrations: ReadonlyArray<(file: unknown) => unknown> = [];

/** migrate가 미래 버전 · 버전 없음 · 버전 형식 오류에서 던지는 에러(3.3 스펙). */
export class MigrationError extends Error {
  constructor(received: unknown) {
    super(`migrate: 지원하지 않는 schemaVersion — 받은 값: ${JSON.stringify(received)}`);
    this.name = "MigrationError";
  }
}

/** 2.2에서 raw.schemaVersion부터 SCHEMA_VERSION까지 migrations를 순서대로 적용하도록 채운다. */
export function migrate(raw: unknown): unknown {
  void raw;
  throw new Error(`migrate: 기능 미구현 (SCHEMA_VERSION=${SCHEMA_VERSION})`);
}
