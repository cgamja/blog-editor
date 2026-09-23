import { z } from "zod";
import { createPostMetaSchema, slugSchema } from "./meta";

/**
 * `GET /public/posts` 응답(plan 3-6 · 3-10). 사이트는 이 스키마를 import하지 않고 자기 zod로
 * 같은 모양을 검증한다 — 두 레포 사이의 계약은 코드가 아니라 모양과 계약 픽스처다.
 * 메타 규칙은 저장 형식과 같고, 저장 전용 필드(`source`)는 나가지 않는다.
 */
export function createPublicPostsResponseSchema(options: {
  categories: readonly [string, ...string[]];
}) {
  const meta = createPostMetaSchema(options).shape;
  const post = z.strictObject({
    slug: slugSchema,
    title: meta.title,
    description: meta.description,
    date: meta.date,
    updated: meta.updated,
    category: meta.category,
    // 보호 대상 — 초안은 공개 조회에 나오지 않는다. 필드를 빼지 않고 false를 명시해 사이트도 검사한다
    draft: z.literal(false),
    // 호스트까지 강제한다 — protocol만 보면 `https:foo`도 통과한다
    image: z.url({ protocol: /^https$/, hostname: z.regexes.domain }).optional(),
    html: z.string().startsWith('<div class="post-body">'),
  });
  return z.strictObject({
    /** API 주소 기준으로 푸는 URL 참조 — `new URL(postCssUrl, BLOG_API_URL)` */
    postCssUrl: z.string().min(1),
    posts: z
      .array(post)
      .refine((posts) => new Set(posts.map((p) => p.slug)).size === posts.length, {
        message: "slug가 겹친다",
      }),
  });
}

export type PublicPostsResponse = z.infer<ReturnType<typeof createPublicPostsResponseSchema>>;
