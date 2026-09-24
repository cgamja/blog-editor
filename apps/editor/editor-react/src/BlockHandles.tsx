import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import {
  INSERTABLE_BLOCKS,
  blockIndexAt,
  dropGapAt,
  insertBlockAfter,
  moveTopBlockTo,
} from "@blog-editor/editor-core";
import type { BlockBand } from "@blog-editor/editor-core";

/**
 * 블록 손잡이 — 마우스를 올린 최상위 블록 왼쪽의 「블록 추가」 · 「블록 옮기기」(디자인 68:2, 이슈 #59).
 * 끌기는 HTML5 DnD가 아니라 포인터 이벤트로 한다(openspec block-drag-handle design.md 1). 문서를 바꾸는 일은
 * editor-core 커맨드 한 번이고, 여기는 화면 좌표를 읽어 번호로 바꾸는 일만 한다.
 */

/** 「블록 추가」 메뉴 항목 — 순서 · 이름은 화면 몫, 종류 목록의 원천은 editor-core INSERTABLE_BLOCKS다. */
const MENU_ITEMS: ReadonlyArray<{ kind: string; label: string }> = [
  { kind: "paragraph", label: "문단" },
  { kind: "heading2", label: "큰 제목" },
  { kind: "heading3", label: "작은 제목" },
  { kind: "bulletList", label: "점 목록" },
  { kind: "orderedList", label: "번호 목록" },
  { kind: "blockquote", label: "인용" },
  { kind: "calloutNote", label: "콜아웃 · 메모" },
  { kind: "calloutTip", label: "콜아웃 · 팁" },
  { kind: "calloutWarning", label: "콜아웃 · 주의" },
  { kind: "horizontalRule", label: "구분선" },
].filter(({ kind }) => Object.hasOwn(INSERTABLE_BLOCKS, kind));

/** 버튼 세로 자리 — 본문 첫 줄(17px × 1.85)의 가운데에 44px 버튼을 맞춘다(디자인 top -6px). */
const HANDLE_OFFSET_Y = -6;

interface Hovered {
  index: number;
  /** 틀(frame) 기준 좌표 */
  top: number;
  left: number;
}

interface Drag {
  from: number;
  gap: number;
  lineTop: number;
}

interface Measured {
  bands: BlockBand[];
  frame: DOMRect;
  /** 최상위 블록 각각의 틀 기준 left */
  lefts: number[];
}

/** 최상위 블록마다 화면 사각형을 읽는다 — https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM */
function measure(editor: Editor, frameEl: HTMLElement): Measured {
  const { view } = editor;
  const frame = frameEl.getBoundingClientRect();
  const bands: BlockBand[] = [];
  const lefts: number[] = [];
  let pos = 0;
  view.state.doc.forEach((node) => {
    const dom = view.nodeDOM(pos);
    const previous = bands.at(-1)?.bottom ?? frame.top;
    if (dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect();
      bands.push({ top: rect.top, bottom: rect.bottom });
      lefts.push(rect.left - frame.left);
    } else {
      bands.push({ top: previous, bottom: previous });
      lefts.push(0);
    }
    pos += node.nodeSize;
  });
  return { bands, frame, lefts };
}

/** gap 자리 표시선의 틀 기준 y — 두 블록 사이 가운데, 양 끝이면 블록 바깥 가장자리. */
function lineTopOf(bands: readonly BlockBand[], gap: number, frameTop: number): number {
  const before = bands[gap - 1];
  const after = bands[gap];
  const y =
    before === undefined
      ? (after?.top ?? frameTop)
      : after === undefined
        ? before.bottom
        : (before.bottom + after.top) / 2;
  return y - frameTop;
}

export interface BlockHandlesProps {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
}

export function BlockHandles({ editor, frameRef }: BlockHandlesProps) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 이벤트 리스너가 최신 값을 읽도록 — 리스너를 다시 달지 않는다
  const frozen = useRef(false);
  frozen.current = drag !== null || menuOpen;

  const run = (command: Command) =>
    editor
      .chain()
      .focus()
      .command(({ state, dispatch }) => command(state, dispatch))
      .run();

  // 마우스를 올린 블록 찾기 — 틀 안 어디서든(손잡이 위 포함, 손잡이는 틀의 자손이다)
  useEffect(() => {
    const frameEl = frameRef.current;
    if (frameEl === null) return undefined;
    const onMove = (event: globalThis.PointerEvent) => {
      if (frozen.current) return;
      const { bands, frame, lefts } = measure(editor, frameEl);
      const index = blockIndexAt(bands, event.clientY);
      if (index === null) return setHovered(null);
      setHovered({
        index,
        top: bands[index]!.top - frame.top + HANDLE_OFFSET_Y,
        left: lefts[index]!,
      });
    };
    const onLeave = () => {
      if (!frozen.current) setHovered(null);
    };
    frameEl.addEventListener("pointermove", onMove);
    frameEl.addEventListener("pointerleave", onLeave);
    return () => {
      frameEl.removeEventListener("pointermove", onMove);
      frameEl.removeEventListener("pointerleave", onLeave);
    };
  }, [editor, frameRef]);

  // 글을 고치면 블록 자리가 바뀐다 — 옛 좌표의 손잡이를 남기지 않는다
  useEffect(() => {
    const hide = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged && !frozen.current) setHovered(null);
    };
    editor.on("transaction", hide);
    return () => {
      editor.off("transaction", hide);
    };
  }, [editor]);

  // 끄는 동안 Esc = 취소
  useEffect(() => {
    if (drag === null) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drag]);

  // 메뉴 밖을 누르면 닫는다
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (event: globalThis.PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (!menuRef.current?.contains(target) && !addRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  if (hovered === null) return null;

  const gapFor = (clientY: number, frameEl: HTMLElement) => {
    const { bands, frame } = measure(editor, frameEl);
    const gap = dropGapAt(bands, clientY);
    return { gap, lineTop: lineTopOf(bands, gap, frame.top) };
  };

  const onHandleDown = (event: PointerEvent<HTMLButtonElement>) => {
    const frameEl = frameRef.current;
    // 한글 조합 중에는 문서를 바꾸는 일을 시작하지 않는다(.claude/rules/editor.md)
    if (frameEl === null || editor.view.composing || !editor.isEditable) return;
    // 편집 영역의 포커스 · 선택이 버튼으로 튀지 않게
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setMenuOpen(false);
    setDrag({ from: hovered.index, ...gapFor(event.clientY, frameEl) });
  };

  const onHandleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const frameEl = frameRef.current;
    if (drag === null || frameEl === null) return;
    setDrag({ from: drag.from, ...gapFor(event.clientY, frameEl) });
  };

  const onHandleUp = () => {
    if (drag === null) return;
    setDrag(null);
    run(moveTopBlockTo(drag.from, drag.gap));
  };

  const closeMenu = () => {
    setMenuOpen(false);
    addRef.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    ];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      items[(current + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  };

  const choose = (kind: string) => {
    setMenuOpen(false);
    setHovered(null);
    run(insertBlockAfter(hovered.index, kind));
  };

  return (
    <>
      <div className="block-handles" style={{ top: hovered.top, left: hovered.left }}>
        <button
          ref={addRef}
          type="button"
          className="block-handle-add"
          aria-label="블록 추가"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {/* Tab 순서에서 뺀다 — 마우스를 올린 블록에만 뜨는 버튼이다. 키보드는 Mod-Shift-↑/↓(design.md 4) */}
        <button
          type="button"
          className="block-handle-move"
          aria-label="블록 옮기기"
          title="끌어서 옮기기 · 키보드는 Ctrl/⌘ + Shift + ↑/↓"
          tabIndex={-1}
          data-dragging={drag !== null || undefined}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={() => setDrag(null)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            className="block-add-menu"
            role="menu"
            aria-label="블록 추가"
            tabIndex={-1}
            onKeyDown={onMenuKey}
          >
            {MENU_ITEMS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => choose(kind)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {drag !== null && (
        <div className="block-drop-line" style={{ top: drag.lineTop }} aria-hidden="true" />
      )}
    </>
  );
}
