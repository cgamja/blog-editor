import { Extension } from "@tiptap/core";
import { keymap } from "@tiptap/pm/keymap";
import { Plugin } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { swallowing } from "../commands/move-block";
import { applyLastColor, toggleToolbarMark } from "../commands/text-style";
import { lastColorKey } from "../commands/text-style.constants";
import type { LastColor } from "../commands/text-style.types";

/**
 * 글자 서식 단축키 · 마지막 색 기억 — spec: editor-text-style, text-toolbar design.md 4.
 * 기준: https://www.notion.com/help/keyboard-shortcuts (⌘U · ⌘⇧S · ⌘⇧H)
 */
export const textStyleKeymap: Record<string, Command> = {
  // 셋 다 거절돼도 키를 삼킨다 — 빠져나가면 브라우저 단축키가 된다
  // (Windows Ctrl+U 페이지 소스, macOS Chrome ⌘⇧H 홈 페이지)
  "Mod-u": swallowing(toggleToolbarMark("underline")),
  "Mod-Shift-s": swallowing(toggleToolbarMark("strike")),
  "Mod-Shift-h": swallowing(applyLastColor),
};

/**
 * 마지막에 건 색을 에디터 상태에 기억한다 — 문서가 아니라서 저장 · 되돌리기와 무관하다.
 * https://prosemirror.net/docs/ref/#state.StateField.apply
 */
export function textStyleMemory(): Plugin<LastColor | null> {
  return new Plugin<LastColor | null>({
    key: lastColorKey,
    state: {
      init: () => null,
      apply: (tr, previous) => (tr.getMeta(lastColorKey) as LastColor | undefined) ?? previous,
    },
  });
}

/** 조립하는 쪽이 고른다(MarkdownShortcuts와 같다). 등록만 한다(adr-002) */
export const TextStyleKeys = Extension.create({
  name: "textStyleKeys",
  addProseMirrorPlugins: () => [textStyleMemory(), keymap(textStyleKeymap)],
});
