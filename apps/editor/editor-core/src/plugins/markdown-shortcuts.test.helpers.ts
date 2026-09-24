import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

interface TypedResult {
  /** 마지막 글자를 입력 규칙이 처리했나 */
  handled: boolean;
  state: EditorState;
}

/**
 * 한 글자씩 입력한다. 입력 규칙 플러그인의 handleTextInput(진짜 prosemirror-inputrules run)을 부르고,
 * 처리하지 않은 글자는 브라우저처럼 그대로 넣는다. 조합 중이면 뷰가 문서를 바꾸지 않는 것으로 둔다.
 * 가짜 뷰는 run이 읽는 표면(state · composing · dispatch)만 갖는다 — prosemirror-inputrules 1.5.1 dist/index.js run.
 */
export function typeText(
  initial: EditorState,
  text: string,
  { composing = false }: { composing?: boolean } = {},
): TypedResult {
  const plugin = initial.plugins.find((candidate) => candidate.spec.isInputRules === true);
  if (plugin === undefined) throw new Error("typeText: 입력 규칙 플러그인이 없다");
  const view = {
    state: initial,
    composing,
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
  };
  let handled = false;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const insert = () => view.state.tr.insertText(char, from, to);
    handled =
      plugin.props.handleTextInput?.call(
        plugin,
        view as unknown as EditorView,
        from,
        to,
        char,
        insert,
      ) ?? false;
    if (!handled && !composing) view.dispatch(insert());
  }
  return { handled, state: view.state };
}

/**
 * 조합이 끝났을 때 — prosemirror-inputrules는 compositionend 뒤 setTimeout으로 커서 앞 글자를 text ""로 다시 본다
 * (1.5.1 dist/index.js handleDOMEvents.compositionend). 그 타이머까지 기다린 상태를 돌려준다.
 */
export async function endComposition(initial: EditorState): Promise<EditorState> {
  const plugin = initial.plugins.find((candidate) => candidate.spec.isInputRules === true);
  if (plugin === undefined) throw new Error("endComposition: 입력 규칙 플러그인이 없다");
  const view = {
    state: initial,
    composing: false,
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
  };
  plugin.props.handleDOMEvents?.compositionend?.call(
    plugin,
    view as unknown as EditorView,
    new Event("compositionend") as CompositionEvent,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return view.state;
}
