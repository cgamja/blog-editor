/**
 * 다른 상태에서 돈 커맨드를 지금 트랜잭션에 잇는다. 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Transform.step · Selection.map: https://prosemirror.net/docs/ref/#transform.Transform.step
 * - TipTap 체인의 공유 트랜잭션: https://tiptap.dev/docs/editor/api/commands#chain-commands
 */
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";

/**
 * `derived`(문서는 `tr.doc`과 같고 선택 등만 다른 상태)에서 `command`를 돌려, 나온 step을 `tr`에 옮겨 담는다.
 * 커맨드가 부른 dispatch를 그대로 보내지 않는 이유는 TipTap 체인이다 — 체인은 `state.tr`을 공유 트랜잭션으로
 * 주고 커맨드가 부른 dispatch는 무시한 채 그 공유 트랜잭션만 적용한다(block-controls design.md 5).
 * 선택은 마지막 트랜잭션의 것을 `tr.doc`으로 옮긴다(문서가 같아 빈 매핑으로 맞는다).
 * 거절이면 false이고 `tr`은 그대로다. 받아들였지만 dispatch하지 않았으면 true이고 `tr.selectionSet`은 false다.
 */
export function appendCommandSteps(
  tr: Transaction,
  derived: EditorState,
  command: Command,
): boolean {
  const inner: Transaction[] = [];
  if (!command(derived, (next) => inner.push(next))) return false;
  const last = inner.at(-1);
  if (last === undefined) return true;
  for (const innerTr of inner) for (const step of innerTr.steps) tr.step(step);
  tr.setSelection(last.selection.map(tr.doc, new Mapping()));
  if (last.scrolledIntoView) tr.scrollIntoView();
  return true;
}
