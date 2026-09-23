import type { ContainerKind, SemanticType } from "./types";

/**
 * 닫힌 집합 허용표 — check.ts(구조) · directives.ts(지시어)가 나눠 쓴다. 한 곳에 모아 두는 이유는
 * 검사와 지시어 귀속이 서로 다른 규칙을 쓰면 조용히 어긋나기 때문이다.
 */

/** 인용 · 목록 항목 · 콜아웃 안에 바로 올 수 있는 블록 의미. */
export const ALLOWED_IN: Record<ContainerKind, ReadonlySet<SemanticType>> = {
  blockquote: new Set(["paragraph"]),
  listItem: new Set(["paragraph", "bulletList", "orderedList"]),
  callout: new Set(["paragraph", "bulletList", "orderedList"]),
};

export const CONTAINER_LABEL: Record<ContainerKind, string> = {
  blockquote: "인용",
  listItem: "목록",
  callout: "콜아웃",
};

/** 지시어 키 전체 집합. */
export const KNOWN_KEYS = new Set(["font", "motion", "width", "frame"]);

/** 블록 의미별로 허용하는 지시어 키(frame은 image에서 따로 검사한다). */
export const KEY_ALLOW: Record<SemanticType, ReadonlySet<string>> = {
  paragraph: new Set(["font", "motion"]),
  heading: new Set(["font", "motion"]),
  bulletList: new Set(["font", "motion"]),
  orderedList: new Set(["font", "motion"]),
  blockquote: new Set(["font", "motion"]),
  callout: new Set(["font", "motion"]),
  codeBlock: new Set(["motion"]),
  horizontalRule: new Set(["motion"]),
  image: new Set(["motion", "width", "frame"]),
};
