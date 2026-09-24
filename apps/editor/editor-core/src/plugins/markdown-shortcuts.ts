import { Extension } from "@tiptap/core";
import { toggleMark } from "@tiptap/pm/commands";
import { InputRule, inputRules, undoInputRule } from "@tiptap/pm/inputrules";
import { keymap } from "@tiptap/pm/keymap";
import { TextSelection } from "@tiptap/pm/state";
import type { Command, EditorState, Plugin, Transaction } from "@tiptap/pm/state";
import { duplicateTopBlock, turnIntoTextblock } from "../commands/turn-into";
import { wrapInBlockquote, wrapInBulletList, wrapInOrderedList } from "../commands/wrap";

/**
 * Notion식 입력 규칙 · 단축키 — spec: editor-markdown-shortcuts, design.md.
 * 기준: https://www.notion.com/help/keyboard-shortcuts (할 일 · 토글은 스키마에 없어 뺐다).
 * 엔진: https://prosemirror.net/docs/ref/#inputrules — 조합 중(view.composing)이면 규칙이 돌지 않는다
 * (prosemirror-inputrules 1.5.1 run, design.md 2).
 */

/** 규칙이 볼 블록 — 최상위(깊이 1) 문단만. 목록 · 인용 · 콜아웃 안은 글자가 그대로 들어간다(design.md 3) */
function isTopBlockOf(state: EditorState, pos: number, types: readonly string[]): boolean {
  const $pos = state.doc.resolve(pos);
  return $pos.depth === 1 && types.includes($pos.parent.type.name);
}

/**
 * 표시 글자를 지운 트랜잭션 위에 커맨드를 잇는다. 라이브러리 wrappingInputRule 대신 꾸미기를 옮기는
 * 우리 커맨드를 쓰기 위해서다 — 커맨드가 거절하면 null이라 글자는 평범하게 입력된다(design.md 1).
 */
function afterDeleting(
  state: EditorState,
  start: number,
  end: number,
  command: Command,
): Transaction | null {
  const tr = state.tr.delete(start, end);
  const deleted = state.apply(tr);
  const results: Transaction[] = [];
  if (!command(deleted, (next) => results.push(next))) return null;
  const [result] = results;
  if (result === undefined) return null;
  for (const step of result.steps) tr.step(step);
  // https://prosemirror.net/docs/ref/#state.Selection.getBookmark — result.doc와 tr.doc은 같은 문서다
  return tr.setSelection(result.selection.getBookmark().resolve(tr.doc));
}

function blockRule(pattern: RegExp, types: readonly string[], command: Command): InputRule {
  return new InputRule(pattern, (state, _match, start, end) =>
    isTopBlockOf(state, start, types) ? afterDeleting(state, start, end, command) : null,
  );
}

const PARAGRAPH = ["paragraph"] as const;
const TEXT_BLOCKS = ["paragraph", "heading"] as const;

/**
 * `--`만 있는 최상위 문단에서 세 번째 `-` — 그 자리에 구분선, 바로 뒤 새 문단에 커서(design.md 5).
 * 새 문단은 옛 문단의 꾸미기를 받아 스티커가 사라지지 않는다.
 */
const horizontalRuleRule = new InputRule(/^---$/, (state, _match, start, end) => {
  const { horizontalRule, paragraph } = state.schema.nodes;
  const $start = state.doc.resolve(start);
  const block = $start.parent;
  const onlyDashes = state.doc.resolve(end).parentOffset === block.content.size;
  if (
    horizontalRule === undefined ||
    paragraph === undefined ||
    !isTopBlockOf(state, start, PARAGRAPH) ||
    !onlyDashes
  ) {
    return null;
  }
  const before = $start.before(1);
  const rule = horizontalRule.create();
  // https://prosemirror.net/docs/ref/#transform.Transform.replaceWith
  const tr = state.tr.replaceWith(before, before + block.nodeSize, [
    rule,
    paragraph.create(block.attrs),
  ]);
  return tr.setSelection(TextSelection.create(tr.doc, before + rule.nodeSize + 1));
});

/**
 * `**글자**` 같은 인라인 규칙. 닫는 표시의 마지막 글자는 아직 문서에 없다(입력 중인 글자).
 * 여는 표시 앞이 같은 표시 문자면 걸지 않아 `**굵게*`에서 기울임이 먼저 걸리지 않는다(design.md 6).
 * https://prosemirror.net/docs/ref/#inputrules.InputRule
 */
function markRule(pattern: RegExp, markName: string, delimiter: string): InputRule {
  return new InputRule(
    pattern,
    (state, match, start, end) => {
      const type = state.schema.marks[markName];
      const [whole, marked] = match;
      if (type === undefined || whole === undefined || marked === undefined) return null;
      if (!state.doc.resolve(start).parent.type.allowsMarkType(type)) return null;
      const from = start + whole.length - marked.length;
      const closeInDoc = delimiter.length - 1;
      const tr = state.tr
        .delete(end - closeInDoc, end)
        .delete(from, from + delimiter.length)
        .addMark(from, end - closeInDoc - delimiter.length, type.create());
      // 이어 치는 글자는 마크 없이 — https://prosemirror.net/docs/ref/#state.Transaction.removeStoredMark
      return tr.removeStoredMark(type);
    },
    { inCodeMark: false },
  );
}

const inputRuleList = [
  blockRule(/^[-*+]\s$/, PARAGRAPH, wrapInBulletList),
  blockRule(/^1\.\s$/, PARAGRAPH, wrapInOrderedList),
  blockRule(/^#{1,2}\s$/, TEXT_BLOCKS, turnIntoTextblock("heading", { level: 2 })),
  blockRule(/^###\s$/, TEXT_BLOCKS, turnIntoTextblock("heading", { level: 3 })),
  blockRule(/^[">]\s$/, PARAGRAPH, wrapInBlockquote),
  blockRule(/^```$/, PARAGRAPH, turnIntoTextblock("codeBlock")),
  horizontalRuleRule,
  markRule(/(?:^|[^*])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, "bold", "**"),
  markRule(/(?:^|[^*])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, "italic", "*"),
  markRule(/(?:^|[^`])(`([^`]+)`)$/, "code", "`"),
];

/** 입력 규칙 플러그인 — 코드 블록 안에서는 규칙이 돌지 않는다(InputRule 기본 inCode: false) */
export function markdownInputRules(): Plugin {
  return inputRules({ rules: inputRuleList });
}

const toggle =
  (markName: string): Command =>
  (state, dispatch) => {
    const type = state.schema.marks[markName];
    // https://prosemirror.net/docs/ref/#commands.toggleMark
    return type === undefined ? false : toggleMark(type)(state, dispatch);
  };

/** 최상위 문단일 때만 — 목록 · 인용 안에서 한 단계 더 감싸지 않는다(design.md 3) */
const onTopParagraph =
  (command: Command): Command =>
  (state, dispatch) =>
    isTopBlockOf(state, state.selection.from, PARAGRAPH) && command(state, dispatch);

/**
 * Notion 단축키(design.md 7). 우리 본문엔 h1이 없어서 ⌘⌥1도 큰 제목(h2)이다.
 * macOS ⌥+숫자는 event.key가 특수 문자지만 prosemirror-keymap이 keyCode로 기본 이름을 찾는다.
 * https://prosemirror.net/docs/ref/#keymap
 */
export const markdownShortcutKeymap: Record<string, Command> = {
  Backspace: undoInputRule,
  "Mod-b": toggle("bold"),
  "Mod-i": toggle("italic"),
  "Mod-e": toggle("code"),
  "Mod-Alt-0": turnIntoTextblock("paragraph"),
  "Mod-Alt-1": turnIntoTextblock("heading", { level: 2 }),
  "Mod-Alt-2": turnIntoTextblock("heading", { level: 2 }),
  "Mod-Alt-3": turnIntoTextblock("heading", { level: 3 }),
  "Mod-Alt-5": onTopParagraph(wrapInBulletList),
  "Mod-Alt-6": onTopParagraph(wrapInOrderedList),
  "Mod-Alt-8": turnIntoTextblock("codeBlock"),
  "Mod-d": duplicateTopBlock,
};

export function markdownShortcutPlugins(): Plugin[] {
  return [markdownInputRules(), keymap(markdownShortcutKeymap)];
}

// 커스텀 블록 Backspace(우선순위 1000)보다 먼저 규칙 되돌리기를 본다 — 되돌릴 게 없으면 false라 다음으로 넘어간다
const MARKDOWN_SHORTCUTS_PRIORITY = 1100;

/**
 * 조립하는 쪽이 고른다(History · MoveBlock과 같다). 등록만 한다(adr-002).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#prosemirror-plugins
 */
export const MarkdownShortcuts = Extension.create({
  name: "markdownShortcuts",
  priority: MARKDOWN_SHORTCUTS_PRIORITY,
  addProseMirrorPlugins: () => markdownShortcutPlugins(),
});
