import type { z } from "zod";

export type HttpMethod = "get" | "post" | "put" | "delete";

export interface ContractResponse {
  description: string;
  /** JSON 본문의 zod 스키마 — 없으면 본문이 JSON이 아니다(204 · 바이너리 · CSS) */
  schema?: z.ZodType;
  /** JSON이 아닌 본문의 Content-Type */
  contentType?: string;
}

export interface ContractOperation {
  method: HttpMethod;
  /** OpenAPI 경로 모양 — `/api/posts/{slug}` */
  path: string;
  operationId: string;
  responses: Readonly<Record<number, ContractResponse>>;
}

export function contractOperations(options: {
  categories: readonly [string, ...string[]];
}): readonly ContractOperation[] {
  throw new Error(`미구현: ${options.categories.length}`);
}

export function buildOpenApiDocument(): Record<string, unknown> {
  throw new Error("미구현");
}
