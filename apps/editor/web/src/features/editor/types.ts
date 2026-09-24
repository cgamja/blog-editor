import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";

/** 저장을 막을 수 있는 「글 정보」 칸 — `missingForSave`가 이 순서로 돌려준다 */
export type MetaField = "title" | "description" | "category" | "slug";

/** 머리줄 저장 상태(디자인 결정 4-A) */
export type SaveStatus =
  | { kind: "idle" }
  | { kind: "incomplete"; missing: readonly MetaField[] }
  | { kind: "saving" }
  | { kind: "saved"; at: Date; isPublished: boolean }
  | { kind: "published" }
  | { kind: "failed"; message: string | null };

/** 저장 실패를 화면이 할 일로 나눈 것 */
export type SaveErrorKind = "expired" | "slugTaken" | "conflict" | "rejected" | "failed";

/** 주소 바꾸기 실패 — 주소 칸 문장(발행 글 · 이미 있는 주소)이 더 있다 */
export type RenameErrorKind = SaveErrorKind | "slugRejected";

/** 초안 저장 · 발행 — 발행 글을 고쳐 반영하는 것도 발행이다 */
export type SaveMode = "draft" | "publish";

/** 불러온 글 — 저장 형식과 ETag(revision) */
export interface LoadedPost {
  file: PostFile;
  revision: string;
}

/**
 * 브라우저에 남긴 쓰던 글(localDraft). `baseRevision`은 이 글을 쓰기 시작한 서버 revision —
 * 아직 서버에 없는 새 글이면 null.
 */
export interface LocalDraft {
  baseRevision: string | null;
  slug: string;
  meta: PostMeta;
  doc: Doc;
  savedAt: string;
}

export type RestoreDecision = "none" | "restore" | "conflict";

/** 편집을 시작할 상태 — `savedSlug`는 서버에 있는 주소(아직 없으면 null), `slug`는 「글 정보」 칸 값 */
export interface EditingStart {
  meta: PostMeta;
  doc: Doc;
  slug: string;
  savedSlug: string | null;
  revision: string | null;
  /** 서버에서 발행 글인가 — 발행 글은 주소가 잠기고 자동 저장하지 않는다 */
  isPublished: boolean;
  restore: RestoreDecision;
}

/** 머리줄 위에 띄우는 것 — 세션 만료 띠 · 충돌 · 발행 확인 · 미리보기 */
export type EditorOverlay = "conflict" | "publish" | "preview" | null;

/** 편집 세션 — 화면이 스스로 옮긴 주소(adopted)에서는 `sessionKey`를 이어 간다 */
export interface EditingSession {
  routeKey: string;
  sessionKey: string;
  adopted: string | null;
}
