import { FONTS, TEXT_SIZES } from "@blog-editor/content-schema";
import { MIXED, rememberColor, setTextStyle } from "@blog-editor/editor-core";
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
import type {
  ColorKind,
  TextStyleMenu,
  ToolbarItemProps,
  ToolbarMenuOption,
} from "./text-toolbar-types";

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
  // 색은 걸고 나서 ⌘⇧H가 다시 걸 수 있게 기억한다 — 스타일과 기억은 따로 부른다(spec: 마지막 색)
  const applyColor = (key: ColorKind) => (value: string | null) => {
    if (run(setTextStyle({ [key]: value })) && value !== null) run(rememberColor({ key, value }));
  };
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
        menu={{
          label: textToolbarMessages.font,
          current: summaryLabel(summary.font, FONT_LABELS),
          options: FONT_OPTIONS,
          selected: selectedOf(summary.font),
        }}
        open={openMenu === "font"}
        onOpenChange={openChange("font")}
        onChoose={choose("font")}
        item={itemProps("font")}
      />
      <ToolbarMenu
        menu={{
          label: textToolbarMessages.weight,
          current: summaryLabel(summary.weight, WEIGHT_LABELS),
          options: weightOptions,
          selected: selectedOf(summary.weight),
        }}
        open={openMenu === "weight"}
        onOpenChange={openChange("weight")}
        onChoose={choose("weight")}
        disabledReason={weights.reason}
        item={itemProps("weight")}
      />
      <ToolbarMenu
        menu={{
          label: textToolbarMessages.size,
          current: summaryLabel(summary.size, SIZE_LABELS),
          options: SIZE_OPTIONS,
          selected: selectedOf(summary.size),
        }}
        open={openMenu === "size"}
        onOpenChange={openChange("size")}
        onChoose={choose("size")}
        item={itemProps("size")}
      />
      <ColorPicker
        kind="color"
        selected={summary.color}
        other={summary.highlight}
        open={openMenu === "color"}
        onOpenChange={openChange("color")}
        onApply={applyColor("color")}
        item={itemProps("color")}
      />
      <ColorPicker
        kind="highlight"
        selected={summary.highlight}
        other={summary.color}
        open={openMenu === "highlight"}
        onOpenChange={openChange("highlight")}
        onApply={applyColor("highlight")}
        item={itemProps("highlight")}
      />
    </>
  );
}
