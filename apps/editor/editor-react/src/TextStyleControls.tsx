import { FONTS, TEXT_SIZES } from "@blog-editor/content-schema";
import { MIXED, setTextStyle } from "@blog-editor/editor-core";
import type { SummaryValue, TextStylePatch, TextStyleSummary } from "@blog-editor/editor-core";
import type { Command } from "@tiptap/pm/state";
import { ColorPicker } from "./ColorPicker";
import {
  FONT_LABELS,
  SIZE_LABELS,
  WEIGHT_LABELS,
  textToolbarMessages,
} from "./text-toolbar-messages";
import { summaryLabel, weightOptionsFor } from "./text-toolbar-model";
import { ToolbarMenu } from "./ToolbarMenu";
import type { ToolbarMenuOption } from "./ToolbarMenu";

/** 도구줄 안에서 펼치는 것들 — 한 번에 하나만 열린다 */
export type TextStyleMenu = "font" | "weight" | "size" | "color" | "highlight";

/** 로빙 tabindex 한 칸(APG toolbar) — 도구줄이 순서와 포커스를 맡는다 */
export interface ToolbarItemProps {
  tabIndex: number;
  registerButton: (button: HTMLButtonElement | null) => void;
}

export interface TextStyleControlsProps {
  summary: TextStyleSummary;
  openMenu: TextStyleMenu | null;
  onOpenMenuChange: (menu: TextStyleMenu | null) => void;
  run: (command: Command) => boolean;
  /** 이 컨트롤들의 로빙 칸 — 글꼴 · 두께 · 크기 · 글자색 · 배경색 순서 */
  itemProps: (menu: TextStyleMenu) => ToolbarItemProps;
}

const FONT_OPTIONS: readonly ToolbarMenuOption[] = [
  { value: null, label: textToolbarMessages.none },
  ...FONTS.map((font) => ({ value: font, label: FONT_LABELS[font], previewFont: font })),
];

// 크기는 작은 것부터 — "보통"(값 없음)이 작게와 크게 사이에 온다
const SIZE_OPTIONS: readonly ToolbarMenuOption[] = [
  { value: TEXT_SIZES[0], label: SIZE_LABELS[TEXT_SIZES[0]] },
  { value: null, label: textToolbarMessages.sizeNormal },
  ...TEXT_SIZES.slice(1).map((size) => ({ value: size, label: SIZE_LABELS[size] })),
];

const selectedOf = (value: SummaryValue<string>) => (value === MIXED ? undefined : value);

/**
 * 글꼴 · 두께 · 크기 드롭다운과 글자색 · 배경색 고르기(spec: editor-text-style). 값은 요약에서 읽고
 * 바꾸기는 editor-core setTextStyle로만 한다. 두께는 글꼴에 있는 것만 보인다(ADR-020).
 */
export function TextStyleControls({
  summary,
  openMenu,
  onOpenMenuChange,
  run,
  itemProps,
}: TextStyleControlsProps) {
  const openChange = (menu: TextStyleMenu) => (open: boolean) =>
    onOpenMenuChange(open ? menu : null);
  const choose = (key: keyof TextStylePatch) => (value: string | null) =>
    run(setTextStyle({ [key]: value } as TextStylePatch));
  const weights = weightOptionsFor(summary.font);
  const weightOptions: readonly ToolbarMenuOption[] = [
    { value: null, label: textToolbarMessages.none },
    ...weights.weights.map((weight) => ({
      value: weight,
      label: WEIGHT_LABELS[weight as keyof typeof WEIGHT_LABELS],
    })),
  ];

  return (
    <>
      <ToolbarMenu
        label={textToolbarMessages.font}
        current={summaryLabel(summary.font, FONT_LABELS)}
        options={FONT_OPTIONS}
        selected={selectedOf(summary.font)}
        open={openMenu === "font"}
        onOpenChange={openChange("font")}
        onChoose={choose("font")}
        {...itemProps("font")}
      />
      <ToolbarMenu
        label={textToolbarMessages.weight}
        current={summaryLabel(summary.weight, WEIGHT_LABELS)}
        options={weightOptions}
        selected={selectedOf(summary.weight)}
        open={openMenu === "weight"}
        onOpenChange={openChange("weight")}
        onChoose={choose("weight")}
        disabledReason={weights.reason}
        {...itemProps("weight")}
      />
      <ToolbarMenu
        label={textToolbarMessages.size}
        current={summaryLabel(summary.size, SIZE_LABELS)}
        options={SIZE_OPTIONS}
        selected={selectedOf(summary.size)}
        open={openMenu === "size"}
        onOpenChange={openChange("size")}
        onChoose={choose("size")}
        {...itemProps("size")}
      />
      <ColorPicker
        kind="color"
        selected={summary.color}
        other={summary.highlight}
        open={openMenu === "color"}
        onOpenChange={openChange("color")}
        onApply={choose("color")}
        {...itemProps("color")}
      />
      <ColorPicker
        kind="highlight"
        selected={summary.highlight}
        other={summary.color}
        open={openMenu === "highlight"}
        onOpenChange={openChange("highlight")}
        onApply={choose("highlight")}
        {...itemProps("highlight")}
      />
    </>
  );
}
