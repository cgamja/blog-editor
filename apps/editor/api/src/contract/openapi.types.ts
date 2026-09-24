import type { z } from "zod";

export type HttpMethod = "get" | "post" | "put" | "delete";

export interface ContractResponse {
  description: string;
  /** JSON 본문의 zod 스키마 — 없으면 본문이 JSON이 아니다(204 · 바이너리 · CSS) */
  schema?: z.ZodType;
  /** JSON이 아닌 본문의 미디어 타입 — 문서에 적히고 응답 `Content-Type`이 이 값을 포함한다 */
  contentType?: string;
  /** 테스트 전용 — 응답 `Content-Type`이 이 값으로 시작한다(문서에는 적지 않는다, 예: `image/`) */
  contentTypePrefix?: string;
  /** 문서에 적는 미디어 타입 목록 — 없으면 `contentType` 하나 */
  mediaTypes?: readonly string[];
  /** 응답 헤더 이름과 설명 */
  headers?: Readonly<Record<string, string>>;
}

export interface ContractParameter {
  name: string;
  in: "path" | "header";
  required: boolean;
  description: string;
  /** 경로 매개변수의 zod 스키마 — 헤더는 문자열 */
  schema?: z.ZodType;
}

export interface ContractRequestBody {
  description: string;
  /** JSON 본문 */
  schema?: z.ZodType;
  /** JSON이 아닌 본문의 미디어 타입 */
  mediaTypes?: readonly string[];
}

export interface ContractOperation {
  method: HttpMethod;
  /** OpenAPI 경로 모양 — `/api/posts/{slug}` */
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  description?: string;
  requiresSession: boolean;
  parameters?: readonly ContractParameter[];
  requestBody?: ContractRequestBody;
  responses: Readonly<Record<number, ContractResponse>>;
}
