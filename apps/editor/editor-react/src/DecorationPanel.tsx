import { useEditorState, type Editor } from "@tiptap/react";
import {
  addSticker,
  motionPreviewKey,
  previewMotion,
  setBlockAlign,
  setBlockFont,
  setBlockMotion,
} from "@blog-editor/editor-core";
import { AlignField } from "./AlignField";
import { decorationMessages } from "./decoration-messages";
import { decorationPanelStateOf } from "./decoration-state";
import type { StickerId } from "./decoration-types";
import { FontField } from "./FontField";
import { MotionField } from "./MotionField";
import { MotionPreviewButton } from "./MotionPreviewButton";
import { StickerField } from "./StickerField";
import { useCommandRunner } from "./use-command-runner";

export interface DecorationPanelProps {
  editor: Editor;
  /** 스티커 그림 주소. 없으면 스티커 이름을 글자로 보인다 */
  stickerSrc?: (id: StickerId) => string;
}

/**
 * 오른쪽 「꾸미기」 패널(디자인 69:2, spec: decoration-panel) — 필드를 조합만 한다. 값은 EditorState에서 파생하고
 * (useEditorState, 기본 비교는 deep equal — https://tiptap.dev/docs/editor/getting-started/install/react#optimize-your-performance),
 * 바꾸기는 editor-core 커맨드로만 한다. 탭 틀(「글 정보」 | 「꾸미기」)은 화면(web)의 몫이다.
 */
export function DecorationPanel({ editor, stickerSrc }: DecorationPanelProps) {
  const panel = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      ...decorationPanelStateOf(current.state),
      previewing: motionPreviewKey.getState(current.state) != null,
    }),
  });
  const run = useCommandRunner(editor);

  return (
    <aside className="decoration-panel" aria-label={decorationMessages.panelLabel}>
      <p className="decoration-panel-target">
        {decorationMessages.targetLine(panel.target?.label ?? null)}
      </p>
      <FontField
        value={panel.font.value}
        availability={panel.font.availability}
        onChange={(font) => run(setBlockFont(font))}
      />
      <AlignField
        value={panel.align.value}
        availability={panel.align.availability}
        onChange={(align) => run(setBlockAlign(align))}
      />
      <StickerField
        count={panel.sticker.count}
        availability={panel.sticker.availability}
        stickerSrc={stickerSrc}
        onAdd={(id) => run(addSticker(id))}
      />
      <MotionField
        value={panel.motion.value}
        availability={panel.motion.availability}
        onChange={(motion) => run(setBlockMotion(motion))}
      />
      <MotionPreviewButton
        hasMotion={panel.motion.value !== null}
        previewing={panel.previewing}
        onPreview={() => run(previewMotion)}
      />
    </aside>
  );
}
