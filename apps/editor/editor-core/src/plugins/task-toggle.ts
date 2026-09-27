import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { toggleTaskItem } from "../commands/task-list";

/**
 * 할 일 체크 칸 누르기 — spec: editor-task-list, adr-036. 체크 칸은 NodeView · 위젯 없이 CSS(`li[data-checked]::before`)로
 * 그린다. 가상 요소를 누르면 이벤트 대상은 그 요소를 가진 `li` 자신이다 — 글 문단(`p`) · 안쪽 목록을 누르면 대상이 그 요소라
 * 받지 않는다. 항목 요소를 누른 것 중에서도 첫 문단 **첫 줄** 높이의 왼쪽(체크 칸 자리)만 받는다 — 안쪽 목록 옆 ·
 * 꺾인 둘째 줄 옆 왼쪽 여백도 대상이 바깥 `li`라 세로 범위로 거른다.
 * mousedown에서 받아 기본 동작(커서 옮기기 · 선택 시작)을 막는다. 조합(IME) 중에는 문서를 바꾸지 않는다(view.composing).
 * - handleDOMEvents(true면 기본 처리 · preventDefault는 핸들러 몫): https://prosemirror.net/docs/ref/#view.EditorProps.handleDOMEvents
 * - posAtDOM: https://prosemirror.net/docs/ref/#view.EditorView.posAtDOM
 * - coordsAtPos(글자 자리의 뷰포트 좌표 — 첫 글자의 줄): https://prosemirror.net/docs/ref/#view.EditorView.coordsAtPos
 * - getBoundingClientRect(뷰포트 기준 left · top · bottom — clientX · clientY와 같은 좌표계):
 *   https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
 * - MouseEvent.clientX · clientY: https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientY
 */

export const taskToggleKey = new PluginKey("taskToggle");

/** editor-core에는 DOM 타입이 없다 — 핸들러가 읽는 표면만 적는다 */
interface TaskItemElement {
  readonly tagName: string;
  readonly firstElementChild: {
    getBoundingClientRect(): { left: number; top: number; bottom: number };
  } | null;
  getAttribute(name: string): string | null;
}

interface PointerLike {
  readonly target: unknown;
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  preventDefault(): void;
}

const PRIMARY_BUTTON = 0;

function isTaskItemElement(target: unknown): target is TaskItemElement {
  const element = target as Partial<TaskItemElement> | null;
  return (
    element?.tagName === "LI" &&
    typeof element.getAttribute === "function" &&
    element.getAttribute("data-checked") !== null
  );
}

/** listItem 앞 자리에서 첫 문단 첫 글자까지 — 항목 여는 자리 1 + 문단 여는 자리 1 */
const FIRST_TEXT_OFFSET = 2;

/**
 * 누른 곳이 첫 문단 왼쪽 · 첫 줄 높이 안인가 — 체크 칸은 글머리 기호 자리(첫 줄 왼쪽 여백)에 있다.
 * 첫 줄은 문단 위쪽부터 첫 글자 줄의 아래까지다. coordsAtPos는 글자 상자(줄 간격 빼고)를 주므로, 문단 위와 글자 위의
 * 틈(줄 간격의 위쪽 절반)만큼 아래로도 넓혀 줄 전체를 덮는다.
 */
function isOnCheckbox(
  view: EditorView,
  item: TaskItemElement,
  itemPos: number,
  pointer: PointerLike,
): boolean {
  const paragraph = item.firstElementChild;
  if (paragraph === null) return false;
  const rect = paragraph.getBoundingClientRect();
  const firstGlyph = view.coordsAtPos(itemPos + FIRST_TEXT_OFFSET);
  const lineBottom = firstGlyph.bottom + (firstGlyph.top - rect.top);
  return (
    pointer.clientX < rect.left && pointer.clientY >= rect.top && pointer.clientY <= lineBottom
  );
}

/** 항목 요소의 문서 자리 — posAtDOM(li, 0)은 항목 안쪽 시작이라 한 칸 앞이 항목 자신이다 */
function itemPosOf(view: EditorView, item: TaskItemElement): number | null {
  const inside = view.posAtDOM(item as unknown as Parameters<EditorView["posAtDOM"]>[0], 0);
  const $inside = view.state.doc.resolve(inside);
  for (let depth = $inside.depth; depth > 0; depth -= 1) {
    if ($inside.node(depth).type.name === "listItem") return $inside.before(depth);
  }
  return null;
}

export function taskToggle(): Plugin {
  return new Plugin({
    key: taskToggleKey,
    props: {
      handleDOMEvents: {
        mousedown: (view, event) => {
          const pointer = event as unknown as PointerLike;
          const { target } = pointer;
          if (pointer.button !== PRIMARY_BUTTON || view.composing || !view.editable) return false;
          if (!isTaskItemElement(target)) return false;
          const pos = itemPosOf(view, target);
          if (pos === null || !isOnCheckbox(view, target, pos, pointer)) return false;
          pointer.preventDefault();
          return toggleTaskItem(pos)(view.state, view.dispatch);
        },
      },
    },
  });
}
