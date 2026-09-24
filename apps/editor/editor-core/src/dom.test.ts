import { DOMParser } from "@tiptap/pm/model";
import type { DOMOutputSpec, Node } from "@tiptap/pm/model";
import { fixtures } from "@blog-editor/content-schema";
import { createEditorSchema, docToNode } from "./index";
import { el, elementFromSpec, miniDomFromSpecs, readWith } from "./dom.test.helpers";

const schema = createEditorSchema();

function toDom(node: Node): DOMOutputSpec {
  const toDOM = node.type.spec.toDOM;
  if (toDOM === undefined) throw new Error(`${node.type.name}에 toDOM이 없다`);
  return toDOM(node);
}

/** 비교용 — null(없음)과 스티커(HTML에서 읽는 규칙이 없음)를 뺀 attrs. */
function comparable(attrs: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key, value]) => value !== null && key !== "stickers"),
  );
}

const sticker = { id: "heart", x: 50, y: 30, size: 20, rotate: 0 };

/** 스펙 안 `img.post-sticker`의 src만 바꾼 사본. */
function withStickerSrc(spec: DOMOutputSpec, src: string): DOMOutputSpec {
  if (!Array.isArray(spec)) return spec;
  return (spec as unknown[]).map((part) => {
    if (Array.isArray(part)) return withStickerSrc(part as DOMOutputSpec, src);
    const isStickerAttrs =
      part !== null &&
      typeof part === "object" &&
      (part as { class?: string }).class === "post-sticker";
    return isStickerAttrs ? { ...(part as object), src } : part;
  }) as DOMOutputSpec;
}

describe("editor-dom: 에디터 DOM은 공개 HTML과 같은 어휘로 나가고 다시 읽힌다", () => {
  it("WHEN 꾸밈 · 스티커 문단, 폭 60 이미지, 꾸밈 없는 문단을 DOM 스펙으로 낸다 THEN 공개 HTML과 같은 래퍼로 나가고 스티커는 래퍼 안 img다", () => {
    const decorated = schema.nodes.paragraph!.create(
      { font: "jua", motion: "fade-up", stickers: [sticker] },
      schema.text("가"),
    );
    const image = schema.nodes.image!.create({ src: "/images/a.webp", alt: "그림", width: 60 });
    const plain = schema.nodes.paragraph!.create(null, schema.text("나"));

    expect(toDom(decorated)).toEqual([
      "div",
      { class: "post-block", "data-font": "jua", "data-motion": "fade-up" },
      ["p", 0],
      [
        "img",
        {
          class: "post-sticker",
          src: "/stickers/heart.png",
          alt: "",
          contenteditable: "false",
          draggable: "false",
          style: "--x:50;--y:30;--s:20;--r:0",
        },
      ],
    ]);
    expect(toDom(image)).toEqual([
      "div",
      { class: "post-block", style: "--w:60" },
      ["figure", { class: "post-image" }, ["img", { src: "/images/a.webp", alt: "그림" }]],
    ]);
    expect(toDom(plain)).toEqual(["p", 0]);
  });

  it("WHEN 스티커 두 개만 있는 구분선을 DOM 스펙으로 낸다 THEN 래퍼 안 hr 뒤에 스티커 img 둘이고 래퍼에 data · style이 없다", () => {
    const rule = schema.nodes.horizontalRule!.create({
      stickers: [
        { id: "star-coral", x: -25, y: 0, size: 5, rotate: -180 },
        { id: "cloud", x: 100, y: 125, size: 50, rotate: 45 },
      ],
    });

    const [tag, wrapperAttrs, inner, ...stickers] = toDom(rule) as unknown[];

    expect([tag, wrapperAttrs, inner]).toEqual(["div", { class: "post-block" }, ["hr"]]);
    expect(stickers.map((spec) => (spec as [string, Record<string, string>])[1])).toEqual([
      expect.objectContaining({
        src: "/stickers/star-coral.png",
        style: "--x:-25;--y:0;--s:5;--r:-180",
      }),
      expect.objectContaining({
        src: "/stickers/cloud.png",
        style: "--x:100;--y:125;--s:50;--r:45",
      }),
    ]);
  });

  it.each(["decorationMax", "allBlocks"] as const)(
    "WHEN 픽스처 %s의 최상위 블록을 DOM 스펙으로 냈다가 파싱 규칙으로 다시 읽는다 THEN 스티커를 뺀 attrs가 같다",
    (name) => {
      const doc = docToNode(schema, fixtures[name].doc);
      doc.forEach((block) => {
        const read = readWith(schema, "nodes", block.type.name, elementFromSpec(toDom(block)));
        expect(read, block.type.name).not.toBe(false);
        expect(comparable(read as Record<string, unknown>), block.type.name).toEqual(
          comparable(block.attrs),
        );
      });
    },
  );

  it("WHEN 스티커 img의 src를 경로 규칙을 통과하는 값으로 바꾼 문단 · 구분선과 래퍼 밖 같은 img를 DOMParser.parseSlice로 읽는다 THEN 래퍼 안 img는 블록이 되지 않고 래퍼 밖 img만 이미지가 된다", () => {
    const paragraph = schema.nodes.paragraph!.create(
      { font: "jua", stickers: [sticker] },
      schema.text("가"),
    );
    const rule = schema.nodes.horizontalRule!.create({ stickers: [sticker, sticker] });

    // 대조군: `/stickers/` 경로는 imagePathSchema가 먼저 거부하므로, 스티커 자리 img의 src를 경로 규칙을
    // 통과하는 값으로 바꾼다. 그래도 이미지가 안 생기면 막는 것은 래퍼 구조(contentElement · atom)다.
    // 같은 img를 래퍼 밖에 두면 이미지 블록이 되는 것으로 대조군이 유효함을 보인다.
    const passingSrc = "/images/sticker-stand-in.png";
    const specs = [
      withStickerSrc(toDom(paragraph), passingSrc),
      withStickerSrc(toDom(rule), passingSrc),
      ["img", { src: passingSrc, alt: "" }] as DOMOutputSpec,
    ];

    const slice = DOMParser.fromSchema(schema).parseSlice(
      // 가짜 DOM은 파서가 읽는 표면만 가졌다(dom.test.helpers MiniNode) — 파서의 DOM 타입으로 단언한다
      miniDomFromSpecs(specs) as unknown as Parameters<DOMParser["parseSlice"]>[0],
    );

    const types: string[] = [];
    slice.content.descendants((node) => {
      types.push(node.type.name);
    });
    expect(types.filter((type) => type === "image")).toHaveLength(1);
    expect(slice.content.content.map((node) => node.type.name)).toEqual([
      "paragraph",
      "horizontalRule",
      "image",
    ]);
  });
});

describe("editor-dom: HTML 속성을 검증 없이 attrs로 읽지 않는다", () => {
  it("WHEN attribute 이름과 같은 HTML 속성이 붙은 문단 · 이미지를 읽는다 THEN 꾸밈 · 스티커 · 원본 크기로 들어오지 않는다", () => {
    const paragraph = el({
      tag: "p",
      attrs: { font: "jua", motion: "pop", stickers: "[]" },
      children: ["가"],
    });
    const image = el({
      tag: "img",
      attrs: { src: "/images/a.webp", alt: "", width: "800", motion: "pop" },
    });

    expect(comparable(readWith(schema, "nodes", "paragraph", paragraph) as object)).toEqual({});
    expect(comparable(readWith(schema, "nodes", "image", image) as object)).toEqual({
      src: "/images/a.webp",
      alt: "",
    });
  });

  it("WHEN 허용되지 않는 꾸밈 · 톤 · 언어 값을 읽는다 THEN 없는 것으로 읽히고 콜아웃 규칙은 거부한다", () => {
    const wrapper = el({
      tag: "div",
      attrs: {
        class: "post-block",
        "data-font": "comic",
        "data-motion": "spin",
        style: "--w:5",
      },
      children: [
        el({
          tag: "figure",
          attrs: { class: "post-image" },
          children: [el({ tag: "img", attrs: { src: "/images/a.webp", alt: "" } })],
        }),
      ],
    });
    const callout = el({
      tag: "aside",
      attrs: { class: "post-callout", "data-tone": "danger" },
      children: [el({ tag: "p", children: ["가"] })],
    });
    const code = el({
      tag: "pre",
      children: [el({ tag: "code", attrs: { "data-language": "C Sharp" }, children: ["x"] })],
    });

    const paragraphWrapper = el({
      tag: "div",
      attrs: { class: "post-block", "data-font": "comic", "data-motion": "spin" },
      children: [el({ tag: "p", children: ["가"] })],
    });

    expect(comparable(readWith(schema, "nodes", "image", wrapper) as object)).toEqual({
      src: "/images/a.webp",
      alt: "",
    });
    expect(comparable(readWith(schema, "nodes", "paragraph", paragraphWrapper) as object)).toEqual(
      {},
    );
    expect(readWith(schema, "nodes", "callout", callout)).toBe(false);
    expect(comparable(readWith(schema, "nodes", "codeBlock", code) as object)).toEqual({});
  });
});
