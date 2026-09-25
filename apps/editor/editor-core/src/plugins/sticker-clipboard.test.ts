import { Fragment, Slice } from "@tiptap/pm/model";
import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  STICKER_CLIP_ATTR,
  createEditorSchema,
  docFromNode,
  pasteNormalizer,
  stickerClipboard,
} from "../index";

const schema = createEditorSchema();
const paragraph = schema.nodes.paragraph!;
const NONCE = "a".repeat(32);
const FORGED_NONCE = "b".repeat(32);

const stickers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: "heart", x: 10 + i, y: 30, size: 20, rotate: 0 }));

const block = (text: string, count = 0) =>
  paragraph.create(
    count > 0 ? { stickers: stickers(count) } : null,
    text === "" ? null : schema.text(text),
  );

/** 문서를 만들고 `from`~`to`(없으면 커서)를 고른 상태 */
function stateWith(blocks: Node[], from: number, to = from): EditorState {
  const doc = schema.nodes.doc!.create(null, blocks);
  const state = EditorState.create({ schema, doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, from, to)));
}

const closedSlice = (...nodes: Node[]) => new Slice(Fragment.fromArray(nodes), 0, 0);

const markedHtml = (nonce: string) => `<p ${STICKER_CLIP_ATTR}="${nonce}">가</p>`;

interface CopyPaste {
  /** 복사한 조각 — 없으면 `source`의 선택(Selection.content, 복사 핸들러와 같은 것) */
  copied?: Slice;
  /** 복사한 에디터 상태 — 열린 끝 블록이 원래 블록 전체인지 여기서 본다. 없으면 `target` */
  source?: EditorState;
  target: EditorState;
  html?: (nonce: string) => string;
  /** 붙여넣기에서 파싱된 조각 — 없으면 복사한 조각 그대로(prosemirror-view가 data-pm-slice로 같은 열린 깊이를 되살린다) */
  pasted?: Slice;
}

/** 붙여넣기 기본 동작(prosemirror-view 1.42.5 doPaste) — 닫힌 노드 하나면 replaceSelectionWith, 아니면 replaceSelection */
function defaultPaste(state: EditorState, slice: Slice): Transaction {
  const single =
    slice.openStart === 0 && slice.openEnd === 0 && slice.content.childCount === 1
      ? slice.content.firstChild
      : null;
  return single === null
    ? state.tr.replaceSelection(slice)
    : state.tr.replaceSelectionWith(single, false);
}

/**
 * 브라우저가 복사 → 붙여넣기에서 하는 일을 플러그인 훅 순서대로 흉내 낸다(prosemirror-view 1.42.5
 * serializeForClipboard · parseFromClipboard · doPaste). transformPasted는 등록 순서대로 — 정규화가 먼저다.
 * handlePaste가 처리하면 그 트랜잭션을, 아니면 기본 붙여넣기를 쓴다.
 */
function copyThenPaste({ copied, source, target, html = markedHtml, pasted }: CopyPaste) {
  const plugin = stickerClipboard(schema, { nonce: () => NONCE });
  const normalizer = pasteNormalizer();
  const from = source ?? target;
  const copiedSlice = copied ?? from.selection.content();
  plugin.props.transformCopied!.call(plugin, copiedSlice, { state: from } as EditorView);
  let dispatched: Transaction | null = null;
  const view = {
    state: target,
    dispatch: (tr: Transaction) => {
      dispatched = tr;
    },
  } as unknown as EditorView;
  plugin.props.transformPastedHTML!.call(plugin, html(NONCE), view);
  const normalized = normalizer.props.transformPasted!.call(
    normalizer,
    pasted ?? copiedSlice,
    view,
    false,
  );
  const slice = plugin.props.transformPasted!.call(plugin, normalized, view, false);
  const handled = plugin.props.handlePaste?.call(plugin, view, {} as PasteEvent, slice) ?? false;
  const tr: Transaction = handled && dispatched !== null ? dispatched : defaultPaste(target, slice);
  return { slice, doc: tr.doc, selection: tr.selection };
}

// editor-core는 DOM lib 없이 타입 검사한다 — 이벤트는 쓰지 않으므로 훅 타입에서 꺼낸다
type PasteEvent = Parameters<
  NonNullable<ReturnType<typeof stickerClipboard>["props"]["handlePaste"]>
>[1];

const stickerCountOf = (doc: Node) =>
  docFromNode(doc).content.reduce((sum, b) => sum + (b.attrs?.stickers?.length ?? 0), 0);

describe("editor-paste: 같은 탭에서 복사한 스티커는 붙여넣어도 남는다", () => {
  it("WHEN 스티커 있는 블록을 복사해 최상위에 붙인다 THEN 붙은 블록에 같은 스티커가 있다", () => {
    const { slice, doc } = copyThenPaste({
      copied: closedSlice(block("가", 2)),
      target: stateWith([block("본문")], 3),
    });

    expect(slice.content.child(0).attrs.stickers).toEqual(stickers(2));
    expect(stickerCountOf(doc)).toBe(2);
  });

  it("WHEN 클립보드 HTML의 표식이 이 탭이 복사한 것과 다르다 THEN 스티커가 없다", () => {
    const { slice } = copyThenPaste({
      copied: closedSlice(block("가", 2)),
      target: stateWith([block("본문")], 3),
      html: () => markedHtml(FORGED_NONCE),
    });

    expect(slice.content.child(0).attrs.stickers).toBeNull();
  });

  it("WHEN 붙이면 글 하나 스티커 상한을 넘는다 THEN 넘치는 만큼 붙인 쪽 뒤에서부터 빠지고 글은 모두 붙는다", () => {
    // 이미 10개 — 붙일 4개 중 2개만 들어간다
    const { slice, doc } = copyThenPaste({
      copied: closedSlice(block("가", 2), block("나", 2)),
      target: stateWith([block("본문", 10)], 3),
    });

    expect(slice.content.child(0).attrs.stickers).toEqual(stickers(2));
    expect(slice.content.child(1).attrs.stickers).toBeNull();
    expect(slice.content.childCount).toBe(2);
    expect(stickerCountOf(doc)).toBe(12);
  });

  it("WHEN 스티커 있는 문단 글자 가운데에 복사한 스티커 블록을 붙인다 THEN 나뉜 자리 문단의 복제분은 상한 계산에 들지 않아 붙인 블록의 스티커가 모두 남는다", () => {
    // 자리 5개 + 붙일 4개 = 9. 나뉜 뒤 조각의 복제분(5)까지 세면 14라 붙인 쪽이 깎인다. 커서는 "본문|가운데"(1 + 글자 2)
    const { slice } = copyThenPaste({
      copied: closedSlice(block("가", 4)),
      target: stateWith([block("본문가운데", 5)], 3),
    });

    expect(slice.content.child(0).attrs.stickers).toEqual(stickers(4));
  });

  it("WHEN 상한까지 찬 글에서 스티커 블록을 잘라 내 다른 자리에 붙인다 THEN 스티커가 모두 남는다", () => {
    // 잘라내기가 원래 자리를 지운 뒤의 문서 — 남은 9개 + 옮길 3개 = 상한 12. 커서는 블록 끝(1 + 글자 5)
    const { slice, doc } = copyThenPaste({
      copied: closedSlice(block("옮길 블록", 3)),
      target: stateWith([block("남은 블록", 9)], 6),
    });

    expect(slice.content.child(0).attrs.stickers).toEqual(stickers(3));
    expect(stickerCountOf(doc)).toBe(12);
  });

  it("WHEN 문단 글자 전체를 골라(세 번 클릭) 복사해 빈 최상위 문단에 붙인다 THEN 그 문단에 같은 스티커가 있다", () => {
    // 글자 전체 선택은 양끝이 열린 조각(open 1/1)이다 — 붙일 자리 문단에 합쳐지는 모양
    const source = stateWith([block("가나다", 2)], 1, 4);

    const { doc } = copyThenPaste({ source, target: stateWith([block("")], 1) });

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).textContent).toBe("가나다");
    expect(doc.child(0).attrs.stickers).toEqual(stickers(2));
  });

  it("WHEN 문단 글자 전체를 복사해 다른 문단 글자 가운데에 붙인다 THEN 스티커가 없다", () => {
    const source = stateWith([block("가나다", 2)], 1, 4);

    const { doc } = copyThenPaste({ source, target: stateWith([block("본문")], 2) });

    expect(doc.child(0).textContent).toBe("본가나다문");
    expect(stickerCountOf(doc)).toBe(0);
  });

  it("WHEN 문단 글자 일부만 복사해 빈 최상위 문단에 붙인다 THEN 스티커가 없다", () => {
    const source = stateWith([block("가나다", 2)], 2, 4);

    const { doc } = copyThenPaste({ source, target: stateWith([block("")], 1) });

    expect(doc.child(0).textContent).toBe("나다");
    expect(stickerCountOf(doc)).toBe(0);
  });

  it("WHEN 스티커 있는 블록을 복사해 목록 항목 안에 붙인다 THEN 스티커가 없다", () => {
    const list = schema.nodes.bulletList!.create(
      null,
      schema.nodes.listItem!.create(null, block("항목")),
    );

    // 목록(0) · 항목(1) · 문단(2) — 글자는 3부터
    const { doc } = copyThenPaste({
      copied: closedSlice(block("가", 2)),
      target: stateWith([list], 4),
    });

    expect(stickerCountOf(doc)).toBe(0);
  });

  it("WHEN 표식은 맞지만 붙여넣은 조각의 글자가 복사한 것과 다르다 THEN 스티커가 없다", () => {
    const { slice } = copyThenPaste({
      copied: closedSlice(block("가", 2)),
      target: stateWith([block("본문")], 3),
      pasted: closedSlice(block("다른 글자")),
    });

    expect(slice.content.child(0).attrs.stickers).toBeNull();
  });

  it("WHEN 세 번 클릭으로 고른 문단을 뒤에 블록이 있는 빈 문단에 붙인다 THEN 커서가 붙인 문단 글자 끝에 있다", () => {
    const source = stateWith([block("가나다", 2)], 1, 4);

    // 빈 문단(0~1) 뒤에 문단 하나가 더 있다 — 커서가 뒤 블록으로 넘어가지 않아야 한다
    const { doc, selection } = copyThenPaste({
      source,
      target: stateWith([block(""), block("뒤 문단")], 1),
    });

    expect(doc.child(0).attrs.stickers).toEqual(stickers(2));
    expect(selection.empty).toBe(true);
    expect(selection.$from.parent.textContent).toBe("가나다");
    expect(selection.$from.parentOffset).toBe("가나다".length);
  });

  it("WHEN 세 번 클릭으로 고른 문단을 글자 전체를 고른 제목에 붙인다 THEN 제목과 제목의 스티커가 그대로이고 복사한 스티커는 없다", () => {
    const source = stateWith([block("가나다", 2)], 1, 4);
    const heading = schema.nodes.heading!.create(
      { level: 2, stickers: stickers(1) },
      schema.text("제목"),
    );

    const { doc } = copyThenPaste({ source, target: stateWith([heading], 1, 3) });

    expect(doc.child(0).type.name).toBe("heading");
    expect(doc.child(0).textContent).toBe("가나다");
    expect(doc.child(0).attrs.stickers).toEqual(stickers(1));
    expect(stickerCountOf(doc)).toBe(1);
  });
});
