import type { UploadedImageAttrs } from "@blog-editor/editor-core";

export type UploadResult = { ok: true; attrs: UploadedImageAttrs } | { ok: false; message: string };

/**
 * 굽은 이미지 한 장을 올리는 함수 — 부르는 쪽(web은 TanStack Query 뮤테이션, 플레이그라운드는 fetch)이 준다.
 * editor-react는 서버 주소 · 인증을 모른다(.claude/rules/state.md). signal이 끊기면(에디터 교체 · 시간 초과) 멈춘다.
 * 응답을 UploadResult로 바꿀 때는 uploadResultFrom을 쓴다.
 */
export type ImageUploader = (blob: Blob, signal: AbortSignal) => Promise<UploadResult>;
