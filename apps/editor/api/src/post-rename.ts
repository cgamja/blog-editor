import type { Hono } from "hono";
import { z } from "zod";
import { slugSchema } from "@blog-editor/content-schema";
import { etagOf, revisionFromEtag } from "./etag";
import {
  BODY_NOT_JSON_MESSAGE,
  CONFLICT_MESSAGE,
  INVALID_SLUG_MESSAGE,
  POST_NOT_FOUND_MESSAGE,
  PRECONDITION_REQUIRED_MESSAGE,
  PUBLISHED_SLUG_LOCKED_MESSAGE,
  SLUG_TAKEN_MESSAGE,
} from "./messages";
import { ConflictError } from "./store";
import type { PostStore } from "./store";

export const renameBodySchema = z.strictObject({ to: slugSchema });

/** 주소 바꾸기 409의 이유 — 화면이 충돌 대화상자(stale)와 주소 칸 문장(published · taken)으로 나눈다 */
export const RENAME_CONFLICT_REASONS = ["published", "stale", "taken"] as const;
export type RenameConflictReason = (typeof RENAME_CONFLICT_REASONS)[number];

const conflictBody = (message: string, reason: RenameConflictReason) => ({ message, reason });

/**
 * 초안 주소 바꾸기(edit-screen design 5) — 새 주소에 쓰고 옛 주소를 지운다. 옛 글 지우기가 어긋나면
 * 새 주소를 지워 되돌린다. 같은 프로세스 안에서만 원자적이다(운영은 S3 조건부 쓰기 몫 — adr-014와 같은 한계).
 * 발행 글은 주소가 URL이라 잠겨 있다(plan 주소 규칙).
 */
export function registerRenameRoute(app: Hono, store: PostStore): void {
  app.post("/api/posts/:slug/rename", async (c) => {
    const from = c.req.param("slug");
    if (!slugSchema.safeParse(from).success) {
      return c.json({ message: INVALID_SLUG_MESSAGE }, 400);
    }
    const ifMatch = c.req.header("If-Match");
    if (ifMatch === undefined) return c.json({ message: PRECONDITION_REQUIRED_MESSAGE }, 428);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: BODY_NOT_JSON_MESSAGE }, 400);
    }
    const parsed = renameBodySchema.safeParse(body);
    if (!parsed.success) return c.json({ message: INVALID_SLUG_MESSAGE }, 400);
    const { to } = parsed.data;

    const found = await store.get(from);
    if (found === null) return c.json({ message: POST_NOT_FOUND_MESSAGE }, 404);
    if (found.file.meta.draft === false) {
      return c.json(conflictBody(PUBLISHED_SLUG_LOCKED_MESSAGE, "published"), 409);
    }
    if (found.revision !== revisionFromEtag(ifMatch)) {
      return c.json(conflictBody(CONFLICT_MESSAGE, "stale"), 409);
    }

    let moved: { revision: string };
    try {
      moved = await store.put(to, found.file, null);
    } catch (error) {
      if (error instanceof ConflictError) {
        return c.json(conflictBody(SLUG_TAKEN_MESSAGE, "taken"), 409);
      }
      throw error;
    }
    try {
      await store.delete(from, found.revision);
    } catch (error) {
      // 되돌리기가 실패해도 알려야 할 것은 처음 실패다 — 새 주소에 남은 사본은 초안이라 공개되지 않는다
      await store.delete(to, moved.revision).catch(() => undefined);
      if (error instanceof ConflictError) {
        return c.json(conflictBody(CONFLICT_MESSAGE, "stale"), 409);
      }
      throw error;
    }
    c.header("ETag", etagOf(moved.revision));
    return c.json({ slug: to, revision: moved.revision });
  });
}
