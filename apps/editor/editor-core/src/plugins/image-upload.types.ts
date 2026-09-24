/** 올리는 중인 이미지 자리(spec: editor-image-insert) — 문서가 아니라 플러그인 상태에만 있다. */
import type { Decoration } from "@tiptap/pm/view";

export type ImageUploadStatus = "uploading" | "failed";

export interface ImageUploadEntry {
  id: string;
  /** 최상위 블록 사이 자리(gap) — 트랜잭션마다 매핑된다 */
  pos: number;
  status: ImageUploadStatus;
  /** failed일 때 보일 이유 */
  message?: string;
}

/** 올리기가 끝난 그림의 attrs — 응답 `{ path, naturalWidth, naturalHeight }`에서 만든다 */
export interface UploadedImageAttrs {
  src: string;
  alt: string;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * 자리 장식을 그리는 함수 — 다시 시도 · 지우기 버튼이 업로드 상태를 불러야 해서 플러그인을 만드는 쪽이 준다.
 * editor-core는 DOM 타입을 모르므로 widget이 받는 모양을 그대로 쓴다(https://prosemirror.net/docs/ref/#view.Decoration^widget).
 */
export type ImageUploadRender = (
  entry: ImageUploadEntry,
) => Parameters<typeof Decoration.widget>[1];
