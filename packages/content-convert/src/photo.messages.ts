import { BRIEF_MAX_LENGTH, PHOTO_RATIOS, PROMPT_MAX_LENGTH } from "@blog-editor/content-schema";
import { PHOTO_CONTAINER_NAME, PHOTO_PROMPT_PREFIX } from "./constants";
import { blockMessage, docMessage, type FoundMessage } from "./message";

/** 사진 자리(`:::photo`, adr-033) 검사 문장 — AI가 읽고 스스로 고친다. 모두 "사진 자리"로 시작해 무엇이 틀렸는지 찾기 쉽게 */

const EXAMPLE = `:::${PHOTO_CONTAINER_NAME} ratio=4:3 → 설명 한 문단 → (빈 줄 · ${PHOTO_PROMPT_PREFIX} 영어 프롬프트 한 문단, 생략 가능) → :::`;

export function photoRatioMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `사진 자리 비율은 ${PHOTO_RATIOS.join(" · ")}만 쓴다(ratio=만, 생략 가능)`,
    received,
    `:::${PHOTO_CONTAINER_NAME} ratio=4:3`,
  );
}

export function photoNotClosedMessage(line: number, received: string): FoundMessage {
  return docMessage(line, "사진 자리가 닫히지 않았다", received, '설명 뒤에 ":::" 줄 추가');
}

export function photoBriefShapeMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `사진 자리 안에는 꾸밈 없는 설명 글 한 문단과 ${PHOTO_PROMPT_PREFIX}로 시작하는 프롬프트 한 문단(생략 가능)만 쓴다(굵게 · 링크 · 코드 · 줄바꿈 · 목록 없이)`,
    received,
    EXAMPLE,
  );
}

export function photoBriefEmptyMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(topLevel, line, "사진 자리에는 사진 설명이 있어야 한다", received, EXAMPLE);
}

export function photoBriefLengthMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `사진 자리 설명은 ${BRIEF_MAX_LENGTH}자 이하`,
    received,
    "설명을 줄인다",
  );
}

export function photoPromptEmptyMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `사진 자리 ${PHOTO_PROMPT_PREFIX} 뒤에는 이미지 프롬프트가 있어야 한다`,
    received,
    `${PHOTO_PROMPT_PREFIX} 뒤에 영어 프롬프트를 쓰거나 그 문단을 지운다`,
  );
}

/** 설명 문단 안에 `prompt:` 줄 — 빈 줄을 빠뜨리면 프롬프트가 설명(공개 alt의 기본값)에 붙는다 */
export function photoPromptJoinedMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `사진 자리 설명 문단에 ${PHOTO_PROMPT_PREFIX} 줄이 있다 — 설명을 먼저 쓰고, 설명과 ${PHOTO_PROMPT_PREFIX} 사이에 빈 줄을 둔다`,
    received,
    EXAMPLE,
  );
}

export function photoPromptLengthMessage(
  topLevel: number,
  line: number,
  received: string,
): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    `사진 자리 프롬프트는 ${PROMPT_MAX_LENGTH}자 이하`,
    received,
    "프롬프트를 줄인다",
  );
}

export function photoNotTopMessage(topLevel: number, line: number, received: string): FoundMessage {
  return blockMessage(
    topLevel,
    line,
    "사진 자리는 인용 · 목록 · 콜아웃 안에 둘 수 없다",
    received,
    "사진 자리를 맨 바깥(들여쓰기 · > 없이)에 쓴다",
  );
}

export const PHOTO_DIRECTIVE_RULE = "사진 자리에는 지시어({…})를 쓸 수 없다";
export const PHOTO_DIRECTIVE_FIX =
  "지시어 줄을 지운다 — 폭 · 정렬 · 움직임은 사진을 채운 뒤 에디터에서";
