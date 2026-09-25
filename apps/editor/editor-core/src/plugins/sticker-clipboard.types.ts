import type { Sticker } from "@blog-editor/content-schema";

/** 복사한 조각의 최상위 노드 하나 — 붙여넣은 조각이 같은 모양인지 대조하고 스티커를 되살리는 데 쓴다 */
export interface CopiedBlock {
  type: string;
  text: string;
  stickers: Sticker[];
}

/** 표식(nonce) → 그 복사의 최상위 노드들 */
export type StickerClipMemory = Map<string, CopiedBlock[]>;

/**
 * 직렬화 결과(DocumentFragment)에서 이 플러그인이 쓰는 부분만 — editor-core는 DOM lib 없이 타입 검사한다(dom.ts ElementLike와 같은 방식)
 * https://developer.mozilla.org/docs/Web/API/DocumentFragment/firstElementChild
 */
export interface ClipboardFragmentLike {
  readonly firstElementChild: { setAttribute(name: string, value: string): void } | null;
}

/** Web Crypto 중 쓰는 부분 — 브라우저와 Node(19+) 전역 `crypto`. https://developer.mozilla.org/docs/Web/API/Crypto/getRandomValues */
export interface RandomSource {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

export interface StickerClipboardOptions {
  /** 표식 만들기 — 테스트가 고정값을 넣는다 */
  nonce?: () => string;
  /** 기억 장소 — 기본은 이 탭(모듈) 하나를 에디터들이 같이 쓴다 */
  memory?: StickerClipMemory;
}
