import { BRIEF_MAX_LENGTH, PHOTO_RATIOS } from "@blog-editor/content-schema";
import { PHOTO_CONTAINER_NAME } from "./constants";
import { blockMessage, docMessage, type FoundMessage } from "./message";

/** 사진 자리(`:::photo`, adr-033) 검사 문장 — AI가 읽고 스스로 고친다. 모두 "사진 자리"로 시작해 무엇이 틀렸는지 찾기 쉽게 */

const EXAMPLE = `:::${PHOTO_CONTAINER_NAME} ratio=4:3 → 설명 한 문단 → :::`;

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
    "사진 자리 안에는 꾸밈 없는 설명 글 한 문단만 쓴다(굵게 · 링크 · 코드 · 줄바꿈 · 목록 없이)",
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
