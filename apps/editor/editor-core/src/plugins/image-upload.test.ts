import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import {
  createEditorSchema,
  docFromNode,
  docToNode,
  failImageUpload,
  finishImageUpload,
  imageUpload,
  imageUploadsOf,
  startImageUpload,
} from "../index";

const schema = createEditorSchema();

/** 문단 "가"(0–3) · 문단 "나"(3–6) — 두 문단 사이 자리는 3 */
function start(): EditorState {
  const doc = docToNode(schema, {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "가" }] },
      { type: "paragraph", content: [{ type: "text", text: "나" }] },
    ],
  });
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 2),
    plugins: [imageUpload()],
  });
}

const GAP = 3;

const UPLOADED = {
  src: "/images/0123456789abcdef0123456789abcdef.webp",
  alt: "",
  naturalWidth: 800,
  naturalHeight: 600,
};

function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

describe("editor-image-insert: 올리는 동안의 자리 표시는 문서가 아니라 장식이다", () => {
  it("WHEN 첫 문단 뒤 자리에 startImageUpload THEN 문서는 그대로이고 플러그인 상태에 그 자리 · uploading이 있다", () => {
    const initial = start();

    const { ok, state } = run(initial, startImageUpload("a", GAP));

    expect(ok).toBe(true);
    expect(state.doc.eq(initial.doc)).toBe(true);
    expect(imageUploadsOf(state)).toEqual([{ id: "a", pos: GAP, status: "uploading" }]);
  });

  it("WHEN 자리를 더한 뒤 첫 문단에 글자를 넣는다 THEN 자리가 넣은 글자 수만큼 뒤로 옮겨져 두 문단 사이다", () => {
    const withPlace = run(start(), startImageUpload("a", GAP)).state;

    const typed = withPlace.apply(withPlace.tr.insertText("다라", 2));

    const [entry] = imageUploadsOf(typed);
    expect(entry?.pos).toBe(GAP + 2);
    expect(typed.doc.resolve(entry?.pos ?? 0).depth).toBe(0);
  });

  it("WHEN 자리를 더한 뒤 두 문단에 걸친 범위를 지운다 THEN 자리가 사라진다", () => {
    const withPlace = run(start(), startImageUpload("a", GAP)).state;

    const deleted = withPlace.apply(withPlace.tr.delete(2, 5));

    expect(imageUploadsOf(deleted)).toEqual([]);
  });
});

describe("editor-image-insert: 올리기가 끝나면 자리에 그림을 한 번 넣는다", () => {
  it("WHEN 자리 a에 finishImageUpload THEN 두 번째 최상위 블록이 그 그림이고 선택은 그 노드이며 자리는 없다", () => {
    const withPlace = run(start(), startImageUpload("a", GAP)).state;

    const { ok, state } = run(withPlace, finishImageUpload("a", UPLOADED));

    expect(ok).toBe(true);
    expect(state.doc.child(1).type.name).toBe("image");
    expect(state.doc.child(1).attrs).toMatchObject(UPLOADED);
    expect(state.selection).toBeInstanceOf(NodeSelection);
    expect((state.selection as NodeSelection).node.type.name).toBe("image");
    expect(imageUploadsOf(state)).toEqual([]);
    expect(() => docFromNode(state.doc)).not.toThrow();
  });

  it("WHEN 자리가 가로지른 삭제로 사라진 뒤 finishImageUpload THEN false이고 문서는 그대로다", () => {
    const withPlace = run(start(), startImageUpload("a", GAP)).state;
    const deleted = withPlace.apply(withPlace.tr.delete(2, 5));

    const { ok, state } = run(deleted, finishImageUpload("a", UPLOADED));

    expect(ok).toBe(false);
    expect(state.doc.eq(deleted.doc)).toBe(true);
  });

  it("WHEN failImageUpload THEN 자리 상태가 failed이고 그 문장을 가진다", () => {
    const withPlace = run(start(), startImageUpload("a", GAP)).state;

    const { state } = run(withPlace, failImageUpload("a", "이미지는 1MB 이하만 올릴 수 있다"));

    expect(imageUploadsOf(state)).toEqual([
      { id: "a", pos: GAP, status: "failed", message: "이미지는 1MB 이하만 올릴 수 있다" },
    ]);
  });
});
