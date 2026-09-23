import type { ContainerKind, SemanticType } from "./types";

/**
 * 닫힌 집합 — check.ts · directives.ts의 검사 로직과 message.ts의 문장 생성이 같은 값을 봐야
 * 조용히 어긋나지 않는다(문장은 이 값에서 파생시킨다). 각 블록에서만 쓰는 값(예: directives.ts의
 * KEY_ALLOW)은 여기 두지 않고 그 파일에 둔다 — 여기 남은 건 두 곳 이상이 참조하는 것뿐이다.
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

/** 지시어 키 — 이 순서가 직렬화(serialize.ts)가 지시어 줄에 쓰는 순서다. */
export const DIRECTIVE_KEYS = ["frame", "font", "motion", "width"] as const;

export const KNOWN_KEYS: ReadonlySet<string> = new Set(DIRECTIVE_KEYS);

/** `frame`의 유일한 값 — 앱 스크린샷(appScreenshot). */
export const APP_FRAME = "app";

/** 콜아웃 tone을 생략했을 때의 값 — pm-schema.ts(스키마 기본값) · check.ts(파싱) · parser.ts(doc
 * 조립)가 같은 값을 써야 한다. */
export const DEFAULT_CALLOUT_TONE = "note";
