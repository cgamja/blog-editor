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

/** 콜아웃 컨테이너 이름(`:::callout`) — tokens.ts(파서 설정) · check.ts · message.ts · serialize.ts가 같이 쓴다. */
export const CALLOUT_CONTAINER_NAME = "callout";

/** 범위 고치기 동작(adr-031) — range-edit.ts와 MCP update_draft 입력 스키마가 같은 값을 본다. */
export const RANGE_EDIT_COMMANDS = ["replace", "insert_after"] as const;

/** 지시어 키 — 이 순서가 직렬화(serialize.ts)가 지시어 줄에 쓰는 순서다. */
export const DIRECTIVE_KEYS = ["frame", "font", "motion", "align", "width", "size"] as const;

/**
 * 괄호 span의 스타일 키 — 이 순서가 직렬화(serialize-inline.ts)가 `{…}`에 쓰는 순서이고, 키 이름은
 * 스키마 textStyle 속성 이름과 같다(ADR-020). 밑줄은 값 없는 켜기 키로 맨 끝에 쓴다.
 */
export const SPAN_STYLE_KEYS = ["font", "weight", "size", "color", "highlight"] as const;
export const SPAN_UNDERLINE_KEY = "underline";

/**
 * 스티커 지시어 키(adr-032) — 한 줄에 되풀이할 수 있고 모든 최상위 블록에 쓴다. 직렬화는 DIRECTIVE_KEYS 뒤에
 * 블록 안 스티커 순서대로 쓴다.
 */
export const STICKER_DIRECTIVE_KEY = "sticker";

export const KNOWN_KEYS: ReadonlySet<string> = new Set([...DIRECTIVE_KEYS, STICKER_DIRECTIVE_KEY]);

/** `size=<가로>x<세로>`의 가로 · 세로 구분자 — directives.ts(읽기)와 serialize.ts(쓰기)가 같이 쓴다. */
export const SIZE_SEPARATOR = "x";

/** `sticker=<종류>@<x>,<y>,<크기>[,<회전>]`의 구분자(adr-032) — sticker-directive.ts(읽기 · 쓰기)와 message.ts가 같이 쓴다. */
export const STICKER_KIND_SEPARATOR = "@";
export const STICKER_NUMBER_SEPARATOR = ",";

/** `frame`의 유일한 값 — 앱 스크린샷(appScreenshot). */
export const APP_FRAME = "app";

/** 콜아웃 tone을 생략했을 때의 값 — pm-schema.ts(스키마 기본값) · check.ts(파싱) · parser.ts(doc
 * 조립)가 같은 값을 써야 한다. */
export const DEFAULT_CALLOUT_TONE = "note";

/**
 * 할 일 표지(adr-028 3절 · adr-036, GFM task list) — 읽기(task-list.ts) · 검사(check.ts) · 쓰기(serialize.ts)가 같은 표지를 본다.
 * 읽기: 원문(`inline.content`) 맨 앞 표지 — 뒤에 공백과 글이 있어야 할 일이다. 이스케이프한 `\[`는 맞지 않는다.
 */
export const TASK_MARKER_SOURCE = /^\[([ xX])\][ \t]+(?=\S)/;

/** 글 없는 할 일 표지만 있는 원문 — 검사가 거부한다(빈 항목은 markdown으로 나를 수 없다) */
export const EMPTY_TASK_SOURCE = /^\[[ xX]\]$/;

/** 쓰기 표지 — 체크하지 않음 · 끝남 */
export const TASK_MARKER_TODO = "[ ]";
export const TASK_MARKER_DONE = "[x]";
