import type { ALIGNS, FONTS, MOTIONS } from "@blog-editor/content-schema";

/**
 * check.ts(토큰 검사) · directives.ts(지시어) · parser.ts(doc 조립) · references.ts(참조 정의)가
 * 공유하는 모양. 여기 따로 둔 이유는 오직 하나 — check.ts ↔ directives.ts가 서로를 import하는
 * 순환을 끊는다.
 */

/** 최상위 블록의 "의미" 종류 — markdown-it 토큰 type과 doc의 node type 사이 다리다. */
export type SemanticType =
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "callout"
  | "codeBlock"
  | "horizontalRule"
  | "image";

export type ContainerKind = "blockquote" | "listItem" | "callout";

/** 토큰을 한 번 훑으며 만드는 블록 레지스트리 한 칸 — 지시어 귀속 · 메시지의 블록 번호가 이걸 쓴다. */
export interface BlockRecord {
  /** 0-based, 원문(지시어를 걷어낸 뒤) 줄 번호 — 지시어 귀속 매칭 키. */
  mapStart0: number;
  mapEnd0: number;
  semantic: SemanticType;
  /** 바로 감싼 컨테이너 — "top"이면 doc.content 바로 아래(꾸미기 · 지시어 자리가 있다). */
  container: "top" | ContainerKind;
  /** 최상위 블록 순번(1부터) — 이 블록을 감싼 최상위 블록의 번호(자신이 최상위면 자기 번호). */
  topLevel: number;
  /** semantic이 "image"일 때만 — frame=app 캡션 길이 검사(directives.ts)가 alt 글자를 다시 읽는다. */
  imageAlt?: string;
}

/** 지시어 값 검증을 통과한 뒤 blockRecord.mapStart0로 귀속되는 꾸미기 값. */
export interface ResolvedDirective {
  font?: (typeof FONTS)[number];
  motion?: (typeof MOTIONS)[number];
  width?: number;
  align?: (typeof ALIGNS)[number];
  naturalWidth?: number;
  naturalHeight?: number;
  isAppScreenshot?: boolean;
}

/** markdown-it이 `md.parse(text, env)`로 받는 그릇 — references.ts가 참조 정의 · 사용 라벨을 채운다. */
export interface MarkdownEnv {
  /**
   * 인라인 파싱이 시작되기 전, markdown-it이 block 단계에서 채운 참조 정의의 안정된 스냅샷 —
   * `references`(아래)가 사용 추적용 Proxy로 바뀐 뒤에도 이 필드로 원본을 그대로 순회할 수 있다.
   */
  referenceDefinitions?: Record<string, { title: string; href: string }>;
  /**
   * markdown-it이 직접 읽고 쓰는 참조 정의 테이블 — block 단계가 채우고, inline 단계 동안은
   * references.ts가 Proxy로 감싸 `usedReferenceLabels`를 채운다(spec 결정, 2026-09-23: href가
   * 아니라 라벨로 "쓰였다"를 판단한다).
   */
  references?: Record<string, { title: string; href: string }>;
  /** 인라인 파싱 중 실제로 resolve된(정규화된) 라벨 — references.ts의 "안 쓴 정의" 판단 기준. */
  usedReferenceLabels?: Set<string>;
}
