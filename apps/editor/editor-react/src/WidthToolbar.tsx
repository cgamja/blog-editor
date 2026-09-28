import { useRef } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { alignOf, setBlockAlign, setBlockWidth } from "@blog-editor/editor-core";
import { AlignIcon } from "./AlignIcon";
import { BriefControl } from "./BriefControl";
import { PromptControl } from "./PromptControl";
import { ALIGN_OPTIONS, WIDTH_PRESETS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { widthTargetOf } from "./decoration-state";
import { ImageAltControl } from "./ImageAltControl";
import { useBlockAnchor } from "./use-block-anchor";
import { useCommandRunner } from "./use-command-runner";

export interface WidthToolbarProps {
  editor: Editor;
}

/**
 * 그림 · 앱 스크린샷을 노드로 골랐을 때 블록 위 가운데에 뜨는 폭 도구줄(디자인 69:2, spec: decoration-panel).
 * 부르는 쪽은 에디터와 이 도구줄을 `position: relative` 상자 하나에 함께 둔다 — 위치를 그 상자 기준으로 잰다.
 */
export function WidthToolbar({ editor }: WidthToolbarProps) {
  const target = useEditorState({
    editor,
    selector: ({ editor: current }) => widthTargetOf(current.state),
  });
  // 정렬도 도구줄 대상(노드 선택한 그림 · 스크린샷)의 지금 모양 — 대상이 없으면 쓰이지 않는다
  const align = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { selection } = current.state;
      return selection instanceof NodeSelection ? alignOf(selection.node) : null;
    },
  });
  // 그림이면 대체 텍스트도 도구줄에서 넣는다(스크린샷은 캡션이라 대상이 아니다) — 아니면 null
  const imageAlt = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { selection } = current.state;
      return selection instanceof NodeSelection && selection.node.type.name === "image"
        ? String(selection.node.attrs.alt)
        : null;
    },
  });
  // 그림의 에디터 전용 사진 설명(adr-033) — 그림이 아니면 null, 설명 없는 그림이면 빈 글(설명은 빈 글일 수 없다)
  const imageBrief = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { selection } = current.state;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image")
        return null;
      const brief = selection.node.attrs.brief as string | null;
      return brief ?? "";
    },
  });
  // 사진 자리에서 옮겨 온 이미지 프롬프트(adr-043) — 있는 그림에서만 보인다(사진을 다시 만들 때 참고)
  const imagePrompt = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { selection } = current.state;
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== "image")
        return null;
      return (selection.node.attrs.prompt as string | null) ?? null;
    },
  });
  const run = useCommandRunner(editor);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const anchor = useBlockAnchor(editor, target?.pos ?? null, toolbarRef);

  if (target === null) return null;

  return (
    <div
      ref={toolbarRef}
      className="width-toolbar"
      role="toolbar"
      aria-label={decorationMessages.widthToolbarLabel}
      style={anchor === null ? { visibility: "hidden" } : { left: anchor.left, top: anchor.top }}
      // 누르는 동안 편집 영역의 노드 선택이 풀리지 않게 한다
      onMouseDown={(event) => event.preventDefault()}
    >
      {WIDTH_PRESETS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={target.value === value}
          onClick={() => run(setBlockWidth(value))}
        >
          {label}
        </button>
      ))}
      <span className="width-toolbar-value">{decorationMessages.widthValue(target.value)}</span>
      <span className="width-toolbar-divider" aria-hidden="true" />
      {ALIGN_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-label={decorationMessages.alignButton(label)}
          aria-pressed={align === value}
          onClick={() => run(setBlockAlign(value))}
        >
          <AlignIcon align={value} />
        </button>
      ))}
      {imageAlt !== null && (
        <>
          <span className="width-toolbar-divider" aria-hidden="true" />
          <ImageAltControl key={target.pos} editor={editor} pos={target.pos} alt={imageAlt} />
        </>
      )}
      {imageBrief !== null && (
        <BriefControl
          key={`brief-${target.pos}`}
          editor={editor}
          pos={target.pos}
          brief={imageBrief === "" ? null : imageBrief}
          canRevert
        />
      )}
      {imagePrompt !== null && (
        <PromptControl
          key={`prompt-${target.pos}`}
          editor={editor}
          pos={target.pos}
          prompt={imagePrompt}
          ratio={null}
        />
      )}
    </div>
  );
}
