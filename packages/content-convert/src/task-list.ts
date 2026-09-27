import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { TASK_MARKER_SOURCE } from "./constants";

/**
 * 할 일 목록(adr-028 3절 · adr-036) — 목록 항목 첫 줄 맨 앞의 `[ ]` · `[x]` · `[X]` + 공백 + 글.
 * GFM task list와 같은 모양이지만 markdown-it 플러그인(새 의존성) 대신 core 규칙 하나로 읽는다.
 * https://github.github.com/gfm/#task-list-items-extension-
 */

/** core 규칙 이름 — 인라인 파싱이 끝난 뒤(text_join 뒤) 돈다 */
const TASK_LIST_RULE = "task_list";

/** 할 일 체크 여부를 싣는 list_item_open 토큰의 meta */
export interface TaskItemMeta {
  checked: boolean;
}

/** `list_item_open` 토큰이 할 일 항목이면 체크 여부, 아니면 undefined */
export function taskCheckedOf(token: Token): boolean | undefined {
  return (token.meta as Partial<TaskItemMeta> | null)?.checked;
}

/** list_item_open 바로 뒤의 첫 문단 인라인 — 목록 항목은 문단으로 시작한다(check.ts가 아니면 거부한다) */
function firstInlineOf(tokens: readonly Token[], itemIndex: number): Token | undefined {
  const paragraph = tokens[itemIndex + 1];
  const inline = tokens[itemIndex + 2];
  return paragraph?.type === "paragraph_open" && inline?.type === "inline" ? inline : undefined;
}

/**
 * 첫 글자 토큰에서 원문 표지 길이만큼 뗀다 — 표지와 그 뒤 공백은 이스케이프 · 엔티티가 없는 글자라 원문과 글자가 같다.
 * 정규식으로 공백을 더 떼면 원문 `&#32;`(글 첫머리 공백)까지 지운다.
 */
function markTaskItem(item: Token, inline: Token): void {
  const marker = TASK_MARKER_SOURCE.exec(inline.content);
  const first = inline.children?.[0];
  if (marker === null || first?.type !== "text" || !first.content.startsWith(marker[0])) return;
  const rest = first.content.slice(marker[0].length);
  first.content = rest;
  if (rest === "") inline.children!.shift();
  inline.content = inline.content.slice(marker[0].length);
  item.meta = {
    ...(item.meta as object | null),
    checked: marker[1] !== " ",
  } satisfies TaskItemMeta;
}

/** 목록 항목 첫 줄의 할 일 표지를 떼고 항목 토큰에 체크 여부를 싣는다 */
function taskListRule(state: { tokens: Token[] }): void {
  state.tokens.forEach((token, index) => {
    if (token.type !== "list_item_open") return;
    const inline = firstInlineOf(state.tokens, index);
    if (inline !== undefined) markTaskItem(token, inline);
  });
}

/** https://markdown-it.github.io/markdown-it/#Ruler.push — core 규칙은 인라인 파싱 뒤에 돈다 */
export function useTaskList(md: MarkdownIt): void {
  md.core.ruler.push(TASK_LIST_RULE, taskListRule);
}
