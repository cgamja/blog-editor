import { useRef } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { ImageUploadPlacement } from "@blog-editor/editor-core";
import { BriefControl } from "./BriefControl";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";
import { PromptControl } from "./PromptControl";
import { useBlockAnchor } from "./use-block-anchor";

export interface PhotoPlaceholderToolbarProps {
  editor: Editor;
  /** 파일 고르기를 연다 — 없으면(서버 없이 띄운 에디터) 「사진 올리기」를 두지 않는다 */
  openPicker?: ((gap?: number, placement?: ImageUploadPlacement) => void) | undefined;
}

interface PlaceholderTarget {
  pos: number;
  brief: string;
  prompt: string | null;
  ratio: string | null;
}

/**
 * 사진 자리를 노드로 골랐을 때 블록 위에 뜨는 도구줄(adr-033) — 「사진 올리기」로 고른 사진이 이 자리를 채우고,
 * 「사진 설명」으로 설명을, 「이미지 프롬프트」로 사람이 이미지 도구에 붙여 넣을 프롬프트(adr-043)를 보고 고친다.
 * 부르는 쪽은 에디터와 이 도구줄을 `position: relative` 상자 하나에 함께 둔다.
 */
export function PhotoPlaceholderToolbar({ editor, openPicker }: PhotoPlaceholderToolbarProps) {
  const target = useEditorState({
    editor,
    selector: ({ editor: current }): PlaceholderTarget | null => {
      const { selection } = current.state;
      const isPlaceholder =
        selection instanceof NodeSelection &&
        selection.node.type.name === "photoPlaceholder" &&
        selection.$from.depth === 0;
      if (!isPlaceholder) return null;
      const { brief, prompt, ratio } = selection.node.attrs;
      return {
        pos: selection.from,
        brief: String(brief),
        prompt: (prompt as string | null) ?? null,
        ratio: (ratio as string | null) ?? null,
      };
    },
  });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const anchor = useBlockAnchor(editor, target?.pos ?? null, toolbarRef);

  if (target === null) return null;

  return (
    <div
      ref={toolbarRef}
      className="width-toolbar photo-placeholder-toolbar"
      role="toolbar"
      aria-label={IMAGE_INSERT_MESSAGES.placeholderToolbar}
      style={anchor === null ? { visibility: "hidden" } : { left: anchor.left, top: anchor.top }}
      // 누르는 동안 편집 영역의 노드 선택이 풀리지 않게 한다
      onMouseDown={(event) => event.preventDefault()}
    >
      {openPicker !== undefined && (
        <button type="button" onClick={() => openPicker(target.pos, { fill: true })}>
          {IMAGE_INSERT_MESSAGES.uploadPhoto}
        </button>
      )}
      <BriefControl
        key={target.pos}
        editor={editor}
        pos={target.pos}
        brief={target.brief}
        canRevert={false}
      />
      <PromptControl
        key={`prompt-${target.pos}`}
        editor={editor}
        pos={target.pos}
        prompt={target.prompt}
        ratio={target.ratio}
      />
    </div>
  );
}
