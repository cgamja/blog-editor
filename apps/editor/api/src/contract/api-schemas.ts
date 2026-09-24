import { z } from "zod";
import {
  NATURAL_SIZE_RANGE,
  createPostMetaSchema,
  docSchema,
  imagePathSchema,
  slugSchema,
} from "@blog-editor/content-schema";
import { MAX_GUIDE_LENGTH, MAX_MARKDOWN_LENGTH } from "../input-limits";

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

/** `PUT /api/settings` 본문 — 화면이 고칠 수 있는 것은 가이드뿐이다(카테고리는 앱 설정이 원천) */
export const settingsUpdateSchema = z.strictObject({
  guide: z.string().max(MAX_GUIDE_LENGTH),
});

/** `GET /api/settings` — 가이드 · 카테고리 · 연결 정보(`url`은 OAuth 발급자가 있을 때만) */
export function createSettingsSchema(options: { categories: readonly [string, ...string[]] }) {
  return z.strictObject({
    guide: z.string(),
    categories: z.array(z.enum(options.categories)),
    connector: z.strictObject({ enabled: z.boolean(), url: z.string().nullable() }),
  });
}

/** `POST /api/import/preview` 본문 — MCP `check_draft`처럼 markdown 밖의 키는 무시한다 */
export const importPreviewRequestSchema = z.object({
  markdown: z.string().max(MAX_MARKDOWN_LENGTH),
});

/** 변환 결과 — 실패는 막는 오류뿐이다(변환기가 "빠지지만 가져오는" 손실을 두지 않는다) */
export const importPreviewResultSchema = z.union([
  z.strictObject({
    ok: z.literal(true),
    doc: docSchema,
    html: z.string(),
    suggested: z.strictObject({ title: z.string(), description: z.string() }),
  }),
  z.strictObject({ ok: z.literal(false), messages: z.array(z.string()).min(1) }),
]);
