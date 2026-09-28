import { history, undo } from "@tiptap/pm/history";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { ALT_MAX_LENGTH, docSchema } from "@blog-editor/content-schema";
import {
  createEditorSchema,
  docFromNode,
  docToNode,
  failImageUpload,
  finishImageUpload,
  imageToPlaceholder,
  imageUpload,
  imageUploadsOf,
  retryImageUpload,
  setBrief,
  startImageUpload,
} from "../index";

const schema = createEditorSchema();
const BRIEF = "잠든 아기 옆 낮잠 방";
const IMAGE_SRC = "/images/0123456789abcdef0123456789abcdef.webp";
const UPLOADED = { src: IMAGE_SRC, alt: "", naturalWidth: 800, naturalHeight: 600 };
const paragraph = { type: "paragraph", content: [{ type: "text", text: "봄 산책" }] };

function stateOf(...content: unknown[]): EditorState {
  const doc = docToNode(schema, { type: "doc", content });
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 1),
    plugins: [imageUpload()],
  });
}

function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

/** 문단 "봄 산책"(0–6) 뒤 자리 — 두 번째 최상위 블록 앞 */
const AFTER_PARAGRAPH = 6;

describe("photo-placeholder — 에디터에서 사진 자리를 채우고 설명을 본다", () => {
  it("WHEN 사진 자리와 brief 그림 문서를 노드로 만들고 docFromNode로 되돌린다 THEN 같은 문서다", () => {
    const input = docSchema.parse({
      type: "doc",
      content: [
        { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3" } },
        { type: "photoPlaceholder", attrs: { brief: BRIEF } },
        { type: "image", attrs: { src: IMAGE_SRC, alt: "봄", brief: BRIEF } },
      ],
    });

    const back = docFromNode(docToNode(schema, input));

    expect(back).toEqual(input);
  });

  it("WHEN 사진 자리 앞 자리에서 채우기 올리기를 시작하고 alt 없는 그림으로 끝낸다 THEN 사진 자리가 그 그림이 되고 alt와 brief가 설명이다", () => {
    const initial = stateOf(paragraph, {
      type: "photoPlaceholder",
      attrs: { brief: BRIEF, ratio: "4:3" },
    });

    const started = run(initial, startImageUpload("a", AFTER_PARAGRAPH, { fill: true })).state;
    const finished = run(started, finishImageUpload("a", UPLOADED));

    expect(finished.ok).toBe(true);
    expect(docFromNode(finished.state.doc).content).toEqual([
      paragraph,
      {
        type: "image",
        attrs: { src: IMAGE_SRC, alt: BRIEF, brief: BRIEF, naturalWidth: 800, naturalHeight: 600 },
      },
    ]);
  });

  // 여러 파일을 사진 자리에 놓으면 올리기 대기열(use-upload-queue)은 모든 파일을 같은 자리에서 시작하고 첫 파일만 채우기다
  function fillWithTwo(initial: EditorState, gap: number): EditorState {
    const second = { ...UPLOADED, src: "/images/fedcba9876543210fedcba9876543210.webp" };
    let state = run(initial, startImageUpload("a", gap, { fill: true })).state;
    state = run(state, startImageUpload("b", gap)).state;
    state = run(state, finishImageUpload("a", UPLOADED)).state;
    return run(state, finishImageUpload("b", second)).state;
  }

  it("WHEN 문단 사이 사진 자리에 파일 A · B를 놓아 채운다 THEN 문단 · A · B · 문단 순서다", () => {
    const initial = stateOf(
      paragraph,
      { type: "photoPlaceholder", attrs: { brief: BRIEF } },
      paragraph,
    );

    const srcs = docFromNode(fillWithTwo(initial, AFTER_PARAGRAPH).doc).content.map((block) =>
      block.type === "image" ? block.attrs.src : block.type,
    );

    expect(srcs).toEqual([
      "paragraph",
      IMAGE_SRC,
      "/images/fedcba9876543210fedcba9876543210.webp",
      "paragraph",
    ]);
  });

  it("WHEN 첫 블록인 사진 자리에 파일 A · B를 놓아 채운다 THEN A · B · 문단 순서다", () => {
    const initial = stateOf({ type: "photoPlaceholder", attrs: { brief: BRIEF } }, paragraph);

    const srcs = docFromNode(fillWithTwo(initial, 0).doc).content.map((block) =>
      block.type === "image" ? block.attrs.src : block.type,
    );

    expect(srcs).toEqual([IMAGE_SRC, "/images/fedcba9876543210fedcba9876543210.webp", "paragraph"]);
  });

  it("WHEN 끝 블록인 사진 자리를 채우는 동안 문서 끝 자리에서 다른 올리기가 기다린다 THEN 채우기가 끝나도 끝 자리가 살아 채운 그림 뒤에 들어간다", () => {
    const second = { ...UPLOADED, src: "/images/fedcba9876543210fedcba9876543210.webp" };
    const initial = stateOf(paragraph, { type: "photoPlaceholder", attrs: { brief: BRIEF } });
    let state = run(initial, startImageUpload("a", AFTER_PARAGRAPH, { fill: true })).state;
    state = run(state, startImageUpload("end", state.doc.content.size)).state;
    state = run(state, finishImageUpload("a", UPLOADED)).state;

    const finished = run(state, finishImageUpload("end", second));

    expect(finished.ok).toBe(true);
    expect(
      docFromNode(finished.state.doc).content.map((block) =>
        block.type === "image" ? block.attrs.src : block.type,
      ),
    ).toEqual(["paragraph", IMAGE_SRC, second.src]);
  });

  it("WHEN ALT_MAX_LENGTH-1자 뒤에 이모지가 오는 설명의 사진 자리를 채운다 THEN alt에 외톨이 서러게이트가 없다", () => {
    const brief = `${"가".repeat(ALT_MAX_LENGTH - 1)}🌸 낮잠`;
    const initial = stateOf(paragraph, { type: "photoPlaceholder", attrs: { brief } });
    const started = run(initial, startImageUpload("a", AFTER_PARAGRAPH, { fill: true })).state;

    const image = run(started, finishImageUpload("a", UPLOADED)).state.doc.child(1);

    expect(image.attrs.alt).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("WHEN 채우기 올리기를 시작한 뒤 사진 자리를 지우고 끝낸다 THEN 그 자리에 그림이 들어가고 brief가 없다", () => {
    const initial = stateOf(paragraph, { type: "photoPlaceholder", attrs: { brief: BRIEF } });
    const started = run(initial, startImageUpload("a", AFTER_PARAGRAPH, { fill: true })).state;
    const placeholderEnd = AFTER_PARAGRAPH + started.doc.child(1).nodeSize;
    const cleared = started.apply(started.tr.delete(AFTER_PARAGRAPH, placeholderEnd));

    const finished = run(cleared, finishImageUpload("a", UPLOADED));

    expect(docFromNode(finished.state.doc).content).toEqual([
      paragraph,
      {
        type: "image",
        attrs: { src: IMAGE_SRC, alt: "", naturalWidth: 800, naturalHeight: 600 },
      },
    ]);
  });

  it("WHEN 그림 설명을 바꾸고 · 빈 글로 지우고 · 사진 자리에 빈 설명을 주고 · 1600×900 그림을 사진 자리로 되돌린다 THEN 새 설명 · 설명 없음 · false · 16:9 사진 자리다", () => {
    const image = {
      type: "image",
      attrs: { src: IMAGE_SRC, alt: "봄", brief: BRIEF, naturalWidth: 1600, naturalHeight: 900 },
    };
    const withImage = stateOf(image);
    const withPlaceholder = stateOf({ type: "photoPlaceholder", attrs: { brief: BRIEF } });

    const renamed = run(withImage, setBrief(0, "새 설명"));
    const cleared = run(withImage, setBrief(0, ""));
    const emptyPlaceholder = run(withPlaceholder, setBrief(0, ""));
    const reverted = run(withImage, imageToPlaceholder(0));

    expect(docFromNode(renamed.state.doc).content[0]).toMatchObject({
      attrs: { brief: "새 설명" },
    });
    expect(docFromNode(cleared.state.doc).content[0]).toEqual({
      type: "image",
      attrs: { src: IMAGE_SRC, alt: "봄", naturalWidth: 1600, naturalHeight: 900 },
    });
    expect(emptyPlaceholder.ok).toBe(false);
    expect(docFromNode(reverted.state.doc).content).toEqual([
      { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "16:9" } },
    ]);
  });
});

describe("photo-placeholder — 채우기 · 되돌리기 뒤 끝 자리와 다시 시도(adr-039 · #172)", () => {
  const SECOND = { ...UPLOADED, src: "/images/fedcba9876543210fedcba9876543210.webp" };

  function historyStateOf(...content: unknown[]): EditorState {
    const doc = docToNode(schema, { type: "doc", content });
    return EditorState.create({ doc, plugins: [history(), imageUpload()] });
  }

  const shapes = (state: EditorState) =>
    docFromNode(state.doc).content.map((block) =>
      block.type === "image" ? block.attrs.src : block.type,
    );

  it("WHEN 문단 · 사진 자리 문서에서 사진 자리를 채운 뒤 끝 자리 올리기를 두고 채우기를 되돌린다 THEN 끝 자리가 살아 사진 자리 뒤에 들어간다", () => {
    const initial = historyStateOf(paragraph, {
      type: "photoPlaceholder",
      attrs: { brief: BRIEF },
    });
    let state = run(initial, startImageUpload("a", AFTER_PARAGRAPH, { fill: true })).state;
    state = run(state, finishImageUpload("a", UPLOADED)).state;
    state = run(state, startImageUpload("end", state.doc.content.size)).state;

    state = run(state, undo).state;

    expect(imageUploadsOf(state).map((entry) => entry.id)).toEqual(["end"]);
    const finished = run(state, finishImageUpload("end", SECOND));
    expect(finished.ok).toBe(true);
    expect(shapes(finished.state)).toEqual(["paragraph", "photoPlaceholder", SECOND.src]);
  });

  it("WHEN 사진 자리 하나뿐인 문서에서 사진 자리를 채운 뒤 끝 자리 올리기를 두고 채우기를 되돌린다 THEN 끝 자리가 살아 사진 자리 뒤에 들어간다", () => {
    const initial = historyStateOf({ type: "photoPlaceholder", attrs: { brief: BRIEF } });
    let state = run(initial, startImageUpload("a", 0, { fill: true })).state;
    state = run(state, finishImageUpload("a", UPLOADED)).state;
    state = run(state, startImageUpload("end", state.doc.content.size)).state;

    state = run(state, undo).state;

    expect(imageUploadsOf(state).map((entry) => entry.id)).toEqual(["end"]);
    const finished = run(state, finishImageUpload("end", SECOND));
    expect(finished.ok).toBe(true);
    expect(shapes(finished.state)).toEqual(["photoPlaceholder", SECOND.src]);
  });

  it("WHEN 사진 자리 A · B 중 A를 채우던 올리기가 실패한 뒤 A를 지우고 다시 시도해 끝낸다 THEN B는 사진 자리 그대로이고 그림은 B 앞에 설명 없이 들어간다", () => {
    const initial = stateOf(
      paragraph,
      { type: "photoPlaceholder", attrs: { brief: "A 사진 설명" } },
      { type: "photoPlaceholder", attrs: { brief: "B 사진 설명" } },
    );
    let state = run(initial, startImageUpload("a", AFTER_PARAGRAPH, { fill: true })).state;
    state = run(state, failImageUpload("a", "서버에 닿지 못했어요")).state;
    state = state.apply(state.tr.delete(AFTER_PARAGRAPH, AFTER_PARAGRAPH + 1));

    const retried = run(state, retryImageUpload("a"));
    const finished = run(retried.state, finishImageUpload("a", UPLOADED));

    expect(retried.ok).toBe(true);
    expect(finished.ok).toBe(true);
    expect(docFromNode(finished.state.doc).content).toEqual([
      paragraph,
      {
        type: "image",
        attrs: { src: IMAGE_SRC, alt: "", naturalWidth: 800, naturalHeight: 600 },
      },
      { type: "photoPlaceholder", attrs: { brief: "B 사진 설명" } },
    ]);
  });
});
