import { Fragment, Slice } from "@tiptap/pm/model";
import type { Node, NodeType } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { blockGuard, createEditorSchema } from "../index";
import { stickerSafePaste } from "./sticker-safe-paste";

const schema = createEditorSchema();
const paragraph = schema.nodes.paragraph!;

const stickers = (count: number, id = "heart") =>
  Array.from({ length: count }, (_, i) => ({ id, x: 10 + i, y: 30, size: 20, rotate: 0 }));

const block = (text: string, stickerList: unknown[] = []) =>
  paragraph.create(stickerList.length > 0 ? { stickers: stickerList } : null, schema.text(text));

const closedSlice = (...nodes: Node[]) => new Slice(Fragment.fromArray(nodes), 0, 0);

/** blockGuard가 걸린 에디터 상태 — 커서는 `pos` */
function stateAt(blocks: Node[], pos: number): EditorState {
  const doc = schema.nodes.doc!.create(null, blocks);
  const state = EditorState.create({ schema, doc, plugins: [blockGuard()] });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, pos)));
}

// editor-core는 DOM lib 없이 타입 검사한다 — 이벤트는 쓰지 않으므로 훅 타입에서 꺼낸다
type PasteEvent = Parameters<
  NonNullable<ReturnType<typeof stickerSafePaste>["props"]["handlePaste"]>
>[1];

/**
 * 붙여넣기(prosemirror-view 1.42.5 doPaste): handlePaste가 처리하면 그 트랜잭션, 아니면 기본 붙여넣기 —
 * 닫힌 노드 하나면 replaceSelectionWith, 아니면 replaceSelection. 결과 상태는 blockGuard(filterTransaction)를
 * 거친다 — 거부되면 문서가 그대로다.
 */
function paste(state: EditorState, slice: Slice, event = {} as PasteEvent) {
  const plugin = stickerSafePaste();
  let dispatched: Transaction | null = null;
  const view = {
    state,
    composing: false,
    dispatch: (tr: Transaction) => {
      dispatched = tr;
    },
  } as unknown as EditorView;
  const handled = plugin.props.handlePaste?.call(plugin, view, event, slice) ?? false;
  const single =
    slice.openStart === 0 && slice.openEnd === 0 && slice.content.childCount === 1
      ? slice.content.firstChild
      : null;
  // doPaste는 preferPlain(평소 false)을 넘긴다
  const fallback =
    single === null
      ? state.tr.replaceSelection(slice)
      : state.tr.replaceSelectionWith(single, false);
  return { handled, next: state.apply(handled && dispatched !== null ? dispatched : fallback) };
}

/** 클립보드(DataTransfer)의 필요한 모양만 흉내 낸 붙여넣기 이벤트 */
function clipboardEvent(content: { files: { type: string }[]; html: string; text: string }) {
  const data: Record<string, string> = { "text/html": content.html, "text/plain": content.text };
  return {
    clipboardData: { files: content.files, getData: (format: string) => data[format] ?? "" },
  } as unknown as PasteEvent;
}

const stickersPerBlock = (doc: Node) => {
  const counts: [string, number][] = [];
  doc.forEach((node) => {
    const list = node.attrs.stickers as unknown[] | null;
    counts.push([node.textContent, list?.length ?? 0]);
  });
  return counts;
};

describe("editor-paste: 붙여넣기로 문단이 나뉘어도 스티커는 한 조각에만 남는다", () => {
  it("WHEN 스티커 있는 최상위 문단 글자 가운데에 스티커 있는 문단과 없는 문단을 붙인다 THEN 나뉜 자리 문단의 스티커는 앞 조각에만 남고 붙인 문단의 스티커는 그대로다", () => {
    // "가나|다라" — 커서는 1 + 글자 2
    const state = stateAt([block("가나다라", stickers(3))], 3);

    const { next } = paste(
      state,
      closedSlice(block("붙인", stickers(2, "star-mint")), block("글")),
    );

    expect(stickersPerBlock(next.doc)).toEqual([
      ["가나", 3],
      ["붙인", 2],
      ["글", 0],
      ["다라", 0],
    ]);
  });

  it("WHEN 스티커 있는 최상위 문단 글자 가운데에 닫힌 문단 하나를 붙인다 THEN 나뉜 자리 문단의 스티커는 앞 조각에만 남는다", () => {
    // 닫힌 노드 하나는 기본 붙여넣기가 replaceSelectionWith로 넣는다 — 여러 블록(replaceSelection)과 다른 길이다
    const state = stateAt([block("가나다라", stickers(3))], 3);

    const { next } = paste(state, closedSlice(block("붙인")));

    expect(stickersPerBlock(next.doc)).toEqual([
      ["가나", 3],
      ["붙인", 0],
      ["다라", 0],
    ]);
  });

  it("WHEN 스티커 7개인 문단 가운데에 문단 둘을 붙인다 THEN 붙여넣기가 거부되지 않고 글의 스티커는 7개다", () => {
    // 복제되면 14개 — 글 하나 상한(12)을 넘어 blockGuard가 붙여넣기 전체를 거부한다
    const state = stateAt([block("가나다라", stickers(7))], 3);

    const { next } = paste(state, closedSlice(block("하나"), block("둘")));

    expect(next.doc.childCount).toBe(4);
    expect(stickersPerBlock(next.doc).reduce((sum, [, count]) => sum + count, 0)).toBe(7);
  });

  it("WHEN 이미지 올리기가 파일로 받는 붙여넣기다(이미지 파일 · 글 없음) THEN 가로채지 않고 이미지 올리기에 맡긴다", () => {
    // imageFileInput은 editor-react가 나중에 등록해 이 플러그인보다 뒤에 묻는다 — 먼저 가져가면 파일이 안 올라간다
    const state = stateAt([block("가나다라", stickers(3))], 3);
    const screenshot = clipboardEvent({ files: [{ type: "image/png" }], html: "", text: "" });

    const { handled } = paste(state, closedSlice(block("붙인")), screenshot);

    expect(handled).toBe(false);
  });

  it("WHEN 미리보기 이미지 파일과 글이 함께 온 붙여넣기(Word · Excel 복사)를 스티커 있는 문단 가운데에 붙인다 THEN 이미지 올리기가 받지 않는 글 붙여넣기라 나뉜 자리 문단의 스티커는 앞 조각에만 남는다", () => {
    // 이미지 올리기는 글이 함께 있으면 받지 않는다(shouldTakePastedFiles) — 여기서도 넘기면 기본 붙여넣기로 떨어져 복제된다
    const state = stateAt([block("가나다라", stickers(3))], 3);
    const office = clipboardEvent({
      files: [{ type: "image/png" }],
      html: "<p>하나</p><p>둘</p>",
      text: "하나\n둘",
    });

    const { next } = paste(state, closedSlice(block("하나"), block("둘")), office);

    expect(stickersPerBlock(next.doc)).toEqual([
      ["가나", 3],
      ["하나", 0],
      ["둘", 0],
      ["다라", 0],
    ]);
  });
});

describe("editor-paste: 표 칸 자리의 붙여넣기는 표 칸 편집에 맡긴다", () => {
  it("WHEN 스티커 있는 표의 본문 칸 글자 가운데에 닫힌 표 조각을 붙인다 THEN stickerSafePaste는 받지 않는다", () => {
    const { table, tableRow, tableCell } = schema.nodes as Record<string, NodeType>;
    const cell = (text: string) =>
      tableCell!.create(null, paragraph.create(null, schema.text(text)));
    const stickered = table!.create({ stickers: stickers(1) }, [
      tableRow!.create(null, [cell("머리")]),
      tableRow!.create(null, [cell("가나")]),
    ]);
    let middle = 0;
    stickered.descendants((node, pos) => {
      if (node.isText && node.text === "가나") middle = pos + 1 + 1;
    });
    const pasted = table!.create(null, [tableRow!.create(null, [cell("붙인 칸")])]);

    const { handled } = paste(stateAt([stickered], middle), closedSlice(pasted));

    expect(handled).toBe(false);
  });
});
