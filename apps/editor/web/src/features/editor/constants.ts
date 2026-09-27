import type { MetaField } from "./types";

/** 입력이 멈추고 이만큼 지나면 자동 저장한다(디자인 결정 4-A) */
export const AUTOSAVE_DELAY_MS = 2000;

/** slugSchema의 최대 길이(content-schema meta.ts) */
export const SLUG_MAX_LENGTH = 80;

/** 아직 서버에 없는 새 글의 경로 키 · localDraft 키 */
export const NEW_POST_KEY = "new";

export const POSTS_PATH = "/api/posts";
export const PREVIEW_PATH = "/api/preview";
export const IMAGE_UPLOAD_PATH = "/api/images";
/** 공개 렌더러 스타일 — 미리보기 iframe이 불러온다(공개 API와 같은 파일) */
export const POST_CSS_PATH = "/public/post.css";
/** post.css가 이름으로 참조하는 사이트 토큰 — 미리보기 iframe에 옮긴다(content-render post.css의 var() 목록) */
export const PREVIEW_TOKEN_NAMES = [
  "ink",
  "ink-soft",
  "line",
  "surface-2",
  "brand",
  "brand-ink",
  "brand-soft",
  "accent-ink",
  "accent-soft",
  "danger-ink",
  "postit",
  "font-sans",
  "font-display",
  "font-hand",
] as const;

export const POST_QUERY_KEY = "post";
export const postQueryKey = (slug: string) => [POST_QUERY_KEY, slug] as const;
/** 편집 화면의 카테고리 제안(글 목록에서 뽑은 문자열) — 글 목록 `["posts"]` 아래라 목록 무효화가 함께 닿는다 */
export const POST_CATEGORIES_QUERY_KEY = ["posts", "categories"] as const;
/** 발행 확인의 제목 · 설명 중복 점검에 쓰는 다른 글 — 목록 무효화가 함께 닿게 `["posts"]` 아래에 둔다 */
export const SEO_OTHER_POSTS_QUERY_KEY = ["posts", "seo-others"] as const;

/** 주소 바꾸기 409의 `reason` 중 충돌 대화상자로 가는 것(post-rename-api) */
export const RENAME_STALE_REASON = "stale";

/** localDraft 저장 키 앞머리 — 뒤에 slug(새 글은 `new`) */
export const LOCAL_DRAFT_PREFIX = "blog-editor:draft:";
/** 충돌 「복사해 두고 최신 열기」가 내 글을 남기는 키 앞머리 */
export const LOCAL_COPY_PREFIX = "blog-editor:copy:";

/** 「글 정보」 칸 순서 — 빈칸 안내가 이 순서로 읽힌다 */
export const META_FIELD_ORDER: readonly MetaField[] = ["title", "description", "category", "slug"];
