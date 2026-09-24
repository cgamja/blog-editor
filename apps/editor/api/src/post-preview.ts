import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { docSchema, normalize } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import { MAX_PREVIEW_BODY_BYTES } from "./input-limits";
import { issuesOf } from "./schema-issues";
import {
  BODY_NOT_JSON_MESSAGE,
  PREVIEW_TOO_LARGE_MESSAGE,
  SCHEMA_MISMATCH_MESSAGE,
} from "./messages";

export const previewBodySchema = z.strictObject({ doc: docSchema });

/**
 * 편집 화면 미리보기(edit-screen design 6) — 공개 API와 같은 렌더러 · imageBaseUrl로 그린다. web은
 * content-render를 import할 수 없어(adr-009) 서버가 그린다. 세션이 필요한 `/api` 아래라 초안이 공개 쪽에 나가지 않고,
 * 저장하지 않는다.
 */
export function registerPreviewRoute(app: Hono, imageBaseUrl: string): void {
  const limit = bodyLimit({
    maxSize: MAX_PREVIEW_BODY_BYTES,
    onError: (c) => c.json({ message: PREVIEW_TOO_LARGE_MESSAGE }, 413),
  });
  app.post("/api/preview", limit, async (c) => {
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
