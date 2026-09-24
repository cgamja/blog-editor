import type { Hono } from "hono";
import { z } from "zod";
import { docSchema, normalize } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import { issuesOf } from "./schema-issues";
import { BODY_NOT_JSON_MESSAGE, SCHEMA_MISMATCH_MESSAGE } from "./messages";

export const previewBodySchema = z.strictObject({ doc: docSchema });

/** 미리보기 본문 상한(바이트) — 한 편의 글 문서로 충분한 양. 넘으면 읽지 않고 413 */
export const MAX_PREVIEW_BODY_BYTES = 1024 * 1024;

/**
 * 편집 화면 미리보기(edit-screen design 6) — 공개 API와 같은 렌더러 · imageBaseUrl로 그린다. web은
 * content-render를 import할 수 없어(adr-009) 서버가 그린다. 세션이 필요한 `/api` 아래라 초안이 공개 쪽에 나가지 않고,
 * 저장하지 않는다.
 */
export function registerPreviewRoute(app: Hono, imageBaseUrl: string): void {
  app.post("/api/preview", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: BODY_NOT_JSON_MESSAGE, issues: [] }, 400);
    }
    const parsed = previewBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: SCHEMA_MISMATCH_MESSAGE, issues: issuesOf(parsed.error) }, 400);
    }
    return c.json({ html: renderHtml({ doc: normalize(parsed.data.doc) }, { imageBaseUrl }) });
  });
}
