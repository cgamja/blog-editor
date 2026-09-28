import type { Hono } from "hono";
import { slugSchema } from "@blog-editor/content-schema";
import { checkAiUndo, revertAiEdit } from "./ai-undo";
import type { AiUndoStore } from "./ai-undo-store";
import { etagOf, revisionFromEtag } from "./etag";
import {
  AI_UNDO_UNAVAILABLE_MESSAGE,
  CONFLICT_MESSAGE,
  INVALID_SLUG_MESSAGE,
  POST_NOT_FOUND_MESSAGE,
  PRECONDITION_REQUIRED_MESSAGE,
} from "./messages";
import { ConflictError } from "./store";
import type { PostStore } from "./store";

const HTTP_UNPROCESSABLE = 422;
/** GET이 받는 "화면이 가진 판" 쿼리 이름(계약 openapi.ts가 같은 것을 적는다) */
export const AI_UNDO_REVISION_QUERY = "revision";

/**
 * 편집 화면의 AI 수정 되돌리기(openspec ai-undo · ADR-041) — MCP `revert_draft`와 같은 규칙(ai-undo.ts)이다.
 * GET은 지금 되돌릴 수 있는지만(`?revision=`을 주면 그 판이 지금 판일 때만), POST는 If-Match가 지금 revision일 때 되돌린다. 남긴 판 자체는 내보내지 않는다.
 */
export function registerAiUndoRoutes(
  app: Hono,
  options: { store: PostStore; aiUndo: AiUndoStore },
): void {
  const { store, aiUndo } = options;
  const path = "/api/posts/:slug/ai-undo";

  app.get(path, async (c) => {
    const slug = c.req.param("slug");
    if (!slugSchema.safeParse(slug).success) return c.json({ message: INVALID_SLUG_MESSAGE }, 400);
    // 편집 화면은 자기가 가진 판을 보낸다 — 그 판이 지금 판일 때만 버튼을 보인다(옛 판으로 누르면 409뿐이다)
    const seen = c.req.query(AI_UNDO_REVISION_QUERY);
    const check = await checkAiUndo(store, aiUndo, slug);
    if (!check.ok && check.reason === "notFound") {
      return c.json({ message: POST_NOT_FOUND_MESSAGE }, 404);
    }
    return c.json({ available: check.ok && (seen === undefined || seen === check.revision) });
  });

  app.post(path, async (c) => {
    const slug = c.req.param("slug");
    if (!slugSchema.safeParse(slug).success) return c.json({ message: INVALID_SLUG_MESSAGE }, 400);
    const ifMatch = c.req.header("If-Match");
    if (ifMatch === undefined) return c.json({ message: PRECONDITION_REQUIRED_MESSAGE }, 428);
    const expected = revisionFromEtag(ifMatch);

    const found = await store.get(slug);
    if (found === null) return c.json({ message: POST_NOT_FOUND_MESSAGE }, 404);
    // 화면이 본 판이 지금과 다르면 충돌이 먼저다 — 되돌릴 수 있는지는 지금 판을 본 뒤에 묻는다
    if (found.revision !== expected) return c.json({ message: CONFLICT_MESSAGE }, 409);
    try {
      const reverted = await revertAiEdit(store, aiUndo, slug, expected);
      if (!reverted.ok) {
        if (reverted.reason === "notFound") return c.json({ message: POST_NOT_FOUND_MESSAGE }, 404);
        return c.json(
          { message: AI_UNDO_UNAVAILABLE_MESSAGE, reason: reverted.reason },
          HTTP_UNPROCESSABLE,
        );
      }
      c.header("ETag", etagOf(reverted.revision));
      return c.json({ revision: reverted.revision });
    } catch (error) {
      if (error instanceof ConflictError) return c.json({ message: CONFLICT_MESSAGE }, 409);
      throw error;
    }
  });
}
