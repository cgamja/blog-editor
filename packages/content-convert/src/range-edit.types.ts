import type { RANGE_EDIT_COMMANDS } from "./constants";
import type { ConvertResult } from "./convert";

/** 범위 고치기 요청(adr-031) */
export interface RangeEdit {
  command: (typeof RANGE_EDIT_COMMANDS)[number];
  /** "시작 글...끝 글" 또는 글자 그대로 — 블록 안 보이는 글자로 찾는다 */
  selection: string;
  markdown: string;
}

/** 변환과 같은 모양 — 호출자(MCP)가 두 결과를 같은 길로 다룬다 */
export type RangeEditResult = ConvertResult;

/** 문서를 경로로 고치기 위한 느슨한 모양 — 결과는 끝에서 docSchema가 다시 검사한다 */
export type JsonNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
} & Record<string, unknown>;

/** 문단 인라인 — 글자와 강제 줄바꿈(adr-028) */
export type InlineText = { type: "text"; text: string; marks?: unknown[] } | { type: "hardBreak" };

export interface TextBlockRef {
  /** 이 글자 블록이 든 최상위 블록 순번 */
  top: number;
  /** doc.content부터 이 블록까지의 content 순번 */
  path: number[];
  text: string;
  isCode: boolean;
  /** 글자만 바꾸는 길이 없어 블록째 바꾼다 — 사진 자리(adr-033)는 설명으로 찾지만 설명은 글자 노드가 아니다 */
  isWholeBlockOnly: boolean;
}

/** 글자 블록 목록 안의 한 자리 — `block`은 TextBlockRef 순번, `offset`은 그 블록 글자 안 위치 */
export interface TextPoint {
  block: number;
  offset: number;
}

export interface Found {
  start: TextPoint;
  end: TextPoint;
}

export type Located = { ok: true; found: Found } | { ok: false; messages: [string, ...string[]] };

/** 찾은 범위와 그 범위가 든 문서 — 동작 함수들이 함께 받는다 */
export interface EditRange extends Found {
  content: readonly JsonNode[];
  startRef: TextBlockRef;
  endRef: TextBlockRef;
  blocks: readonly TextBlockRef[];
}

/** 옛 그림의 사진 설명(adr-033) — markdown에는 brief 자리가 없어 새 블록이 스스로 가질 수 없다 */
export interface BriefedImage {
  src: string;
  brief: string;
  /** 문서 최상위 블록 번호(1부터) — 형식 가이드의 '블록 n'과 같다 */
  blockNumber: number;
}
