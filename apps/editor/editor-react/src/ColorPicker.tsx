import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { HIGHLIGHT_COLORS, TEXT_COLORS } from "@blog-editor/content-schema";
import { MIXED, type SummaryValue } from "@blog-editor/editor-core";
import { HIGHLIGHT_LABELS, TEXT_COLOR_LABELS, textToolbarMessages } from "./text-toolbar-messages";
import { isHardToRead, normalizeHexInput, summaryLabel } from "./text-toolbar-model";
import { useEscapeKey } from "./use-dismiss";

export type ColorKind = "color" | "highlight";

export interface ColorPickerProps {
  kind: ColorKind;
  /** 지금 값 */
  selected: SummaryValue<string>;
  /** 반대편 값(글자색이면 배경색) — 대비를 이 조합으로 잰다 */
  other: SummaryValue<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (value: string | null) => void;
  tabIndex: number;
  registerButton: (button: HTMLButtonElement | null) => void;
}

const PRESETS = {
  color: { names: TEXT_COLORS, labels: TEXT_COLOR_LABELS },
  highlight: { names: HIGHLIGHT_COLORS, labels: HIGHLIGHT_LABELS },
} as const;

function contrastOf(kind: ColorKind, value: string, other: SummaryValue<string>) {
  const otherValue = other === MIXED ? null : other;
  return kind === "color"
    ? isHardToRead({ color: value, highlight: otherValue })
    : isHardToRead({ color: otherValue, highlight: value });
}

/**
 * 글자색 · 배경색 고르기 — 디자인 토큰 프리셋 칩 + `#` 직접 입력(ADR-020). 대비가 4.5:1 미만이면
 * 경고하지만 적용은 막지 않는다(design.md 6). 편집 영역이 포커스를 잃어도 선택은 EditorState에 남는다.
 */
export function ColorPicker({
  kind,
  selected,
  other,
  open,
  onOpenChange,
  onApply,
  tabIndex,
  registerButton,
}: ColorPickerProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [invalid, setInvalid] = useState(false);
  const panelId = useId();
  const inputId = useId();
  const errorId = useId();
  const { names, labels } = PRESETS[kind];
  const title = kind === "color" ? textToolbarMessages.color : textToolbarMessages.highlight;

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);

  const typed = normalizeHexInput(input);
  const warnFor = typed ?? (selected === MIXED ? null : selected);
  const hardToRead = warnFor !== null && contrastOf(kind, warnFor, other);

  const apply = (value: string | null) => {
    onApply(value);
    onOpenChange(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (typed === null) setInvalid(true);
    else apply(typed);
  };

  const closeToButton = useCallback(() => {
    onOpenChange(false);
    buttonRef.current?.focus();
  }, [onOpenChange]);
  useEscapeKey(open, closeToButton);

  const currentLabel = summaryLabel(selected, labels);

  return (
    <div className="text-toolbar-menu">
      <button
        ref={(button) => {
          buttonRef.current = button;
          registerButton(button);
        }}
        type="button"
        tabIndex={tabIndex}
        className="text-toolbar-color"
        data-kind={kind}
        aria-label={`${title}: ${currentLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => onOpenChange(!open)}
      >
        {title}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="text-toolbar-popup text-toolbar-colors"
          role="dialog"
          aria-label={title}
        >
          <div className="text-toolbar-swatches">
            <button type="button" aria-pressed={selected === null} onClick={() => apply(null)}>
              {textToolbarMessages.none}
            </button>
            {names.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={selected === name}
                onClick={() => apply(name)}
              >
                <span
                  className="text-toolbar-swatch"
                  data-kind={kind}
                  data-swatch={name}
                  aria-hidden="true"
                />
                {labels[name as keyof typeof labels]}
              </button>
            ))}
          </div>
          <form className="text-toolbar-hex" onSubmit={submit}>
            <label htmlFor={inputId}>{textToolbarMessages.hexLabel}</label>
            <div className="text-toolbar-hex-row">
              <input
                id={inputId}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="#3366aa"
                value={input}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
                onChange={(event) => {
                  setInput(event.target.value);
                  setInvalid(false);
                }}
              />
              <button type="submit">{textToolbarMessages.hexApply}</button>
            </div>
            {invalid && (
              <p id={errorId} className="text-toolbar-error" role="alert">
                {textToolbarMessages.hexInvalid}
              </p>
            )}
          </form>
          <p className="text-toolbar-warning" role="status">
            {hardToRead ? textToolbarMessages.hardToRead : ""}
          </p>
        </div>
      )}
    </div>
  );
}
