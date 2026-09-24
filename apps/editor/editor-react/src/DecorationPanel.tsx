import { useId, useSyncExternalStore } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  addSticker,
  motionPreviewKey,
  previewMotion,
  setBlockFont,
  setBlockMotion,
} from "@blog-editor/editor-core";
import { FONT_OPTIONS, MOTION_OPTIONS, STICKER_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { decorationPanelStateOf } from "./decoration-state";
import type { Availability, StickerId } from "./decoration-types";
import { useCommandRunner } from "./use-command-runner";

export interface DecorationPanelProps {
  editor: Editor;
  /** 스티커 그림 주소. 없으면 스티커 이름을 글자로 보인다(그림 파일은 #58) */
  stickerSrc?: (id: StickerId) => string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
  );
}

const reasonOf = (availability: Availability) =>
  availability.enabled ? null : availability.reason;

/**
 * 오른쪽 「꾸미기」 패널(디자인 69:2, spec: decoration-panel). 값은 EditorState에서 파생하고(useEditorState,
 * 기본 비교는 deep equal — https://tiptap.dev/docs/editor/getting-started/install/react#optimize-your-performance),
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
  const reducedMotion = usePrefersReducedMotion();
  const ids = { font: useId(), sticker: useId(), motion: useId(), preview: useId() };

  const fontReason = reasonOf(panel.font.availability);
  const stickerReason = reasonOf(panel.sticker.availability);
  const motionReason = reasonOf(panel.motion.availability);
  const previewReason = reducedMotion ? decorationMessages.previewReducedMotion : null;

  return (
    <aside className="decoration-panel" aria-label="꾸미기">
      <p className="decoration-panel-target">
        {decorationMessages.targetLine(panel.target?.label ?? null)}
      </p>

      <fieldset>
        <legend>글씨체</legend>
        <div className="decoration-panel-grid">
          {FONT_OPTIONS.map(({ value, label }) => {
            const pressed = panel.font.value === value;
            return (
              <button
                key={value}
                type="button"
                className="decoration-panel-choice"
                aria-pressed={pressed}
                disabled={fontReason !== null}
                aria-describedby={fontReason === null ? undefined : ids.font}
                // 다시 누르면 지운다(본문 기본 글씨체로)
                onClick={() => run(setBlockFont(pressed ? null : value))}
              >
                <span className="decoration-panel-sample" data-font={value}>
                  가나다
                </span>
                <span className="decoration-panel-caption">{label}</span>
              </button>
            );
          })}
        </div>
        {fontReason !== null && (
          <p id={ids.font} className="decoration-panel-hint">
            {fontReason}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>스티커</legend>
        <div className="decoration-panel-grid">
          {STICKER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="decoration-panel-choice decoration-panel-sticker"
              aria-label={decorationMessages.stickerButton(label)}
              disabled={stickerReason !== null}
              aria-describedby={stickerReason === null ? undefined : ids.sticker}
              onClick={() => run(addSticker(id))}
            >
              {stickerSrc === undefined ? label : <img src={stickerSrc(id)} alt="" />}
            </button>
          ))}
        </div>
        <p id={ids.sticker} className="decoration-panel-hint">
          {stickerReason ?? decorationMessages.stickerHint(panel.sticker.count)}
        </p>
      </fieldset>

      <div className="decoration-panel-field">
        <label htmlFor={ids.motion}>움직임</label>
        <select
          id={ids.motion}
          value={panel.motion.value ?? ""}
          disabled={motionReason !== null}
          aria-describedby={`${ids.motion}-hint`}
          onChange={(event) => run(setBlockMotion(event.target.value || null))}
        >
          {MOTION_OPTIONS.map(({ value, label }) => (
            <option key={label} value={value ?? ""}>
              {label}
            </option>
          ))}
        </select>
        <p id={`${ids.motion}-hint`} className="decoration-panel-hint">
          {motionReason ?? decorationMessages.motionHint}
        </p>
      </div>

      <button
        type="button"
        className="decoration-panel-preview"
        disabled={previewReason !== null || panel.motion.value === null || panel.previewing}
        aria-describedby={previewReason === null ? undefined : ids.preview}
        onClick={() => run(previewMotion)}
      >
        움직임 미리 보기
      </button>
      {previewReason !== null && (
        <p id={ids.preview} className="decoration-panel-hint">
          {previewReason}
        </p>
      )}
    </aside>
  );
}
