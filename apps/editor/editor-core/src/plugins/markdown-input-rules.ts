import { DEFAULT_ORDERED_LIST_START } from "@blog-editor/content-schema";
import { InputRule, inputRules } from "@tiptap/pm/inputrules";
import type { Node } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Command, EditorState, Plugin, Transaction } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";
import { orderedListNumberOrNull } from "../closed-values";
import { isInTopBlock, turnIntoTextblock } from "../commands/turn-into";
import {
  carriesDecoration,
  wrapInBlockquote,
  wrapInBulletList,
  wrapInOrderedListFrom,
} from "../commands/wrap";

/**
 * Notion식 입력 규칙 — spec: editor-markdown-shortcuts, markdown-shortcuts design.md.
 * 기준: https://www.notion.com/help/keyboard-shortcuts (할 일 · 토글은 스키마에 없어 뺐다).
 * 엔진: https://prosemirror.net/docs/ref/#inputrules — 조합 중(view.composing)이면 규칙이 돌지 않는다
 * (prosemirror-inputrules 1.5.1 run, design.md 2).
 */

const PARAGRAPH = ["paragraph"] as const;
const TEXT_BLOCKS = ["paragraph", "heading"] as const;

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
    isInTopBlock(state, start, types) ? afterDeleting(state, start, end, command) : null,
  );
}

/**
 * 앞 목록 start + 항목 수 = n — TipTap OrderedList 입력 규칙의 joinPredicate와 같은 조건
 * (https://github.com/ueberdosis/tiptap/blob/main/packages/extension-list/src/ordered-list/ordered-list.ts)
 */
const isNextNumber = (before: Node, number: number) =>
  (before.attrs.start ?? DEFAULT_ORDERED_LIST_START) + before.childCount === number;

/** join은 앞 목록 attrs만 남긴다 — 새 목록이 문단에서 받은 꾸미기가 있으면 합치면 잃는다 */
const keepsDecoration = (list: Node) => !carriesDecoration(list);

/** 감싼 새 목록(pos)을 바로 앞 번호 목록에 합칠까 — 다음 번호이고, 꾸미기를 잃지 않고, 합칠 수 있을 때 */
function joinsListBefore(doc: Node, pos: number, number: number): boolean {
  const { nodeBefore: before, nodeAfter: list } = doc.resolve(pos);
  return (
    before !== null &&
    list !== null &&
    before.type === list.type &&
    isNextNumber(before, number) &&
    keepsDecoration(list) &&
    // https://prosemirror.net/docs/ref/#transform.canJoin
    canJoin(doc, pos)
  );
}

/**
 * 입력 규칙이 번호 목록으로 바꾸는 번호는 1~3자리뿐이다. 한국어 날짜 「2025. 9. 25.」가 start 2025 목록이 되지 않게 하고,
 * 앞자리 0이 붙은 긴 숫자가 markdown-it 번호 상한(9자리)과 어긋나는 일도 없앤다. 큰 번호는 가져오기 · 붙여넣기로 들어온다.
 */
const TYPED_ORDERED_LIST_MARKER = /^(\d{1,3})\.\s$/;

/**
 * `n. ` → n부터 세는 번호 목록(spec: editor-ordered-list-input-rule). 범위 밖 번호는 글자로 남는다.
 * 앞 목록에 이어지면 합치는 방식은 prosemirror-inputrules wrappingInputRule과 같다 — 감싼 뒤 앞 노드와 join
 * (https://prosemirror.net/docs/ref/#inputrules.wrappingInputRule). 감싸기는 원래 문단 자리에 새 목록을 세운다.
 */
const orderedListRule = new InputRule(TYPED_ORDERED_LIST_MARKER, (state, match, start, end) => {
  const number = orderedListNumberOrNull(match[1]);
  if (number === null || !isInTopBlock(state, start, PARAGRAPH)) return null;
  const tr = afterDeleting(state, start, end, wrapInOrderedListFrom(number));
  const listPos = state.doc.resolve(start).before(1);
  // https://prosemirror.net/docs/ref/#transform.Transform.join — 선택은 뒤 단계로 매핑된다
  if (tr !== null && joinsListBefore(tr.doc, listPos, number)) tr.join(listPos);
  return tr;
});

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
    !isInTopBlock(state, start, PARAGRAPH) ||
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
 * `**글자**` 같은 인라인 규칙(design.md 6). 입력 중인 글자는 아직 문서에 없다 — 보통은 닫는 표시의 마지막 한 글자,
 * 조합이 끝난 뒤 다시 볼 때(compositionend)는 0글자다. 문서에 있는 글자 수(end - start)로 나머지를 센다.
 * 고른 글자가 있으면 입력이 선택을 덮어써서 위치가 맞지 않으므로 걸지 않는다.
 * https://prosemirror.net/docs/ref/#inputrules.InputRule
 */
function markRule(pattern: RegExp, markName: string, delimiter: string): InputRule {
  return new InputRule(
    pattern,
    (state, match, start, end) => {
      const type = state.schema.marks[markName];
      const [whole, marked] = match;
      if (type === undefined || whole === undefined || marked === undefined) return null;
      if (!state.selection.empty) return null;
      if (!state.doc.resolve(start).parent.type.allowsMarkType(type)) return null;
      const from = start + whole.length - marked.length;
      const typed = whole.length - (end - start);
      const closeInDoc = delimiter.length - typed;
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
  orderedListRule,
  blockRule(/^#{1,2}\s$/, TEXT_BLOCKS, turnIntoTextblock("heading", { level: 2 })),
  blockRule(/^###\s$/, TEXT_BLOCKS, turnIntoTextblock("heading", { level: 3 })),
  blockRule(/^[">]\s$/, PARAGRAPH, wrapInBlockquote),
  blockRule(/^```$/, PARAGRAPH, turnIntoTextblock("codeBlock")),
  horizontalRuleRule,
  // 여는 `*` 앞이 라틴 문자 · 숫자면 곱셈 · 단어 안 표시라 걸지 않는다(`2*3*`). 한글 뒤 붙여 쓰기는 건다
  markRule(/(?:^|[^*A-Za-z0-9])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, "bold", "**"),
  markRule(/(?:^|[^*A-Za-z0-9])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, "italic", "*"),
  markRule(/(?:^|[^`])(`([^`]+)`)$/, "code", "`"),
];

/** 입력 규칙 플러그인 — 코드 블록 안에서는 규칙이 돌지 않는다(InputRule 기본 inCode: false) */
export function markdownInputRules(): Plugin {
  return inputRules({ rules: inputRuleList });
}
