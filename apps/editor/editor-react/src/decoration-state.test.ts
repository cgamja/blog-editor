import { GapCursor } from "@tiptap/pm/gapcursor";
import type { Node } from "@tiptap/pm/model";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Selection } from "@tiptap/pm/state";
import {
  FONTS,
  MAX_STICKERS_PER_DOC,
  MOTIONS,
  STICKER_IDS,
  WIDTH_RANGE,
} from "@blog-editor/content-schema";
import { createEditorSchema, docToNode } from "@blog-editor/editor-core";
import {
  FONT_OPTIONS,
  MOTION_OPTIONS,
  STICKER_OPTIONS,
  WIDTH_PRESETS,
} from "./decoration-constants";
import { decorationPanelStateOf } from "./decoration-state";

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [{ type: "text", text: value }],
});
const codeBlock = (value: string): Json => ({
  type: "codeBlock",
  content: [{ type: "text", text: value }],
});
const image = (): Json => ({ type: "image", attrs: { src: "/images/a.webp", alt: "그림" } });

function stateOf(blocks: Json[], place: (doc: Node) => Selection): EditorState {
  const doc = docToNode(schema, { type: "doc", content: blocks });
  return EditorState.create({ doc, selection: place(doc) });
}

const cursorInFirst = (doc: Node) => TextSelection.create(doc, 1);

const NO_TARGET = "꾸밀 블록을 먼저 고르세요";

describe("꾸미기 패널 상태", () => {
  it("WHEN font: jua 문단에 커서를 두면 THEN 대상은 문단, 글씨체 jua, 글씨체 · 움직임 · 스티커를 쓸 수 있고 폭 도구줄은 없다", () => {
    const panel = decorationPanelStateOf(
      stateOf([paragraph("가나", { font: "jua" })], cursorInFirst),
    );

    expect(panel.target).toEqual({ label: "문단" });
    expect(panel.font).toEqual({ value: "jua", availability: { enabled: true } });
    expect(panel.motion).toEqual({ value: null, availability: { enabled: true } });
    expect(panel.sticker).toEqual({ count: 0, availability: { enabled: true } });
    expect(panel.width).toBeNull();
  });

  it("WHEN 코드 블록에 커서를 두면 THEN 글씨체는 이유와 함께 막히고 움직임은 쓸 수 있다", () => {
    const panel = decorationPanelStateOf(stateOf([codeBlock("x")], cursorInFirst));

    expect(panel.font.availability).toEqual({
      enabled: false,
      reason: "코드 블록에는 글씨체를 줄 수 없어요",
    });
    expect(panel.motion.availability).toEqual({ enabled: true });
  });

  it("WHEN 폭이 없는 그림을 노드로 고르면 THEN 폭 도구줄 대상은 그 그림 위치이고 값은 100이다", () => {
    const panel = decorationPanelStateOf(
      stateOf([paragraph("가"), image()], (doc) => NodeSelection.create(doc, 3)),
    );

    expect(panel.target).toEqual({ label: "사진" });
    expect(panel.width).toEqual({ pos: 3, value: 100 });
  });

  it("WHEN 스티커가 12개인 글의 문단에 커서를 두면 THEN 스티커가 상한 이유로 막힌다", () => {
    const stickers = Array.from({ length: MAX_STICKERS_PER_DOC }, () => ({
      id: "heart",
      x: 50,
      y: 50,
      size: 10,
      rotate: 0,
    }));
    const panel = decorationPanelStateOf(stateOf([paragraph("가", { stickers })], cursorInFirst));

    expect(panel.sticker).toEqual({
      count: MAX_STICKERS_PER_DOC,
      availability: { enabled: false, reason: "스티커는 글 하나에 12개까지예요" },
    });
  });

  it.each([
    ["전체 선택", (doc: Node) => new AllSelection(doc)],
    ["GapCursor", (doc: Node) => new GapCursor(doc.resolve(doc.content.size))],
  ])("WHEN %s이면 THEN 대상이 없고 모두 막힌다", (_name, place) => {
    const panel = decorationPanelStateOf(stateOf([paragraph("가"), image()], place));
    const blocked = { enabled: false, reason: NO_TARGET };

    expect(panel.target).toBeNull();
    expect(panel.font.availability).toEqual(blocked);
    expect(panel.motion.availability).toEqual(blocked);
    expect(panel.sticker.availability).toEqual(blocked);
  });
});

describe("패널 선택지", () => {
  it("WHEN 선택지를 스키마 상수와 비교하면 THEN 글씨체 · 스티커는 같은 집합, 움직임은 MOTIONS + 없음, 폭은 범위 안이다", () => {
    expect(FONT_OPTIONS.map(({ value }) => value).sort()).toEqual([...FONTS].sort());
    expect(STICKER_OPTIONS.map(({ id }) => id).sort()).toEqual([...STICKER_IDS].sort());
    expect(MOTION_OPTIONS.map(({ value }) => value ?? "없음").sort()).toEqual(
      [...MOTIONS, "없음"].sort(),
    );
    for (const { value } of WIDTH_PRESETS) {
      expect(value).toBeGreaterThanOrEqual(WIDTH_RANGE.min);
      expect(value).toBeLessThanOrEqual(WIDTH_RANGE.max);
    }
  });
});
