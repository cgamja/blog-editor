import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import { docFromNode } from "../doc-node";

const blockGuardKey = new PluginKey("blockGuard");

// 문서 노드는 불변이라 판정을 노드에 묶어 기억한다 — 다음 트랜잭션의 "이전 문서" 판정을 다시 하지 않는다
const validity = new WeakMap<Node, boolean>();

// 규칙의 원천은 zod 하나다 — docFromNode가 던지면 위반이다(design.md 1)
function isClosedSetDoc(doc: Node): boolean {
  const known = validity.get(doc);
  if (known !== undefined) return known;
  let valid = true;
  try {
    docFromNode(doc);
  } catch {
    valid = false;
  }
  validity.set(doc, valid);
  return valid;
}

/**
 * 편집 중에도 문서가 닫힌 집합(content-schema docSchema) 밖으로 나가지 않게, 그런 결과를 내는
 * 트랜잭션을 거부한다(spec: editor-block-guard, design.md). 문서를 고치지 않고 거부만 한다 —
 * 한글 조합 중 문서를 바꾸는 부수 효과는 DOM과 어긋난다(CLAUDE.md, design.md 4).
 * 전제: 에디터의 초기 문서는 docToNode로 만든다 — 이전 문서가 이미 밖이면 막지 않는다(design.md 3).
 * 근거: https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction ·
 * https://prosemirror.net/docs/ref/#state.Transaction.docChanged
 */
export function blockGuard(): Plugin {
  return new Plugin({
    key: blockGuardKey,
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      // 이미 밖인 문서에서 모든 편집을 막으면 에디터가 얼어 고칠 수도 없다(design.md 3)
      if (!isClosedSetDoc(state.doc)) return true;
      return isClosedSetDoc(tr.doc);
    },
  });
}
