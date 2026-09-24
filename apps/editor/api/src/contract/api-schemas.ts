import { z } from "zod";
import {
  NATURAL_SIZE_RANGE,
  createPostMetaSchema,
  imagePathSchema,
  slugSchema,
} from "@blog-editor/content-schema";

/** 오류 응답 대부분 — 화면이 `message`를 그대로 보여 준다(messages.ts) */
export const messageBodySchema = z.strictObject({ message: z.string() });

/** 저장 본문이 스키마에 맞지 않을 때 — `issues`는 zod 이슈의 경로와 메시지 */
export const schemaErrorBodySchema = z.strictObject({
  message: z.string(),
  issues: z.array(
    z.strictObject({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    }),
  ),
});

export const loginBodySchema = z.object({ username: z.string(), password: z.string() });

export const saveResultSchema = z.strictObject({ revision: z.string() });

export const renameResultSchema = z.strictObject({ slug: slugSchema, revision: z.string() });

/** 공개 렌더러가 그린 본문 HTML(`<div class="post-body">…</div>`) */
export const previewResultSchema = z.strictObject({ html: z.string() });

const naturalSide = z.int().min(NATURAL_SIZE_RANGE.min).max(NATURAL_SIZE_RANGE.max);

export const imageUploadResultSchema = z.strictObject({
  path: imagePathSchema,
  naturalWidth: naturalSide,
  naturalHeight: naturalSide,
});

/** 목록의 한 줄 — 저장 형식 메타에서 설명 · 대표 이미지를 뺀 것 */
export function createPostListSchema(options: { categories: readonly [string, ...string[]] }) {
  const meta = createPostMetaSchema(options).shape;
  const summary = z.strictObject({
    slug: slugSchema,
    title: meta.title,
    date: meta.date,
    updated: meta.updated,
    category: meta.category,
    draft: meta.draft,
    source: meta.source,
  });
  return z.strictObject({ posts: z.array(summary) });
}
