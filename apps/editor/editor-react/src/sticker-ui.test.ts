import { anchorLabel, stickerName } from "./sticker-messages";
import {
  readStickerDrag,
  resizedSize,
  rotatedAngle,
  STICKER_DRAG_TYPE,
  writeStickerDrag,
} from "./sticker-ui";
import type { StickerDragData } from "./sticker-ui";

/** DataTransfer의 쓰는 부분만 — node 환경에는 DataTransfer가 없다 */
function fakeDataTransfer(initial: Record<string, string> = {}): StickerDragData {
  const data = new Map(Object.entries(initial));
  return {
    get types() {
      return [...data.keys()];
    },
    getData: (type) => data.get(type) ?? "",
    setData: (type, value) => {
      data.set(type, value);
    },
  };
}

describe("editor-sticker-layer: 스티커 이름과 붙은 블록을 사람 말로 보여 준다", () => {
  it("WHEN stickerName('star-coral') · anchorLabel(paragraph · image · mystery) THEN 코랄 별 · 문단/사진/블록에 붙어 있어요다", () => {
    expect([
      stickerName("star-coral"),
      anchorLabel("paragraph"),
      anchorLabel("image"),
      anchorLabel("mystery"),
    ]).toEqual(["코랄 별", "문단에 붙어 있어요", "사진에 붙어 있어요", "블록에 붙어 있어요"]);
  });
});

describe("editor-sticker-layer: 크기 · 회전 제스처는 손 위치를 허용 범위의 값으로 바꾼다", () => {
  it("WHEN 크기 20에서 거리 40→80, 30에서 10→100, 10에서 50→1 THEN 40, 50, 5다", () => {
    expect([resizedSize(20, 40, 80), resizedSize(30, 10, 100), resizedSize(10, 50, 1)]).toEqual([
      40, 50, 5,
    ]);
  });

  it("WHEN 회전 0에서 0→π/2, 170에서 0→π/6 라디안 THEN 90, -160이다", () => {
    expect([rotatedAngle(0, 0, Math.PI / 2), rotatedAngle(170, 0, Math.PI / 6)]).toEqual([
      90, -160,
    ]);
  });
});

describe("editor-sticker-layer: 패널에서 끌어 오는 스티커는 정해진 형식으로 싣는다", () => {
  it("WHEN heart를 쓰고 읽기, 같은 MIME의 unicorn, 형식 없는 dt THEN heart, null, null이다", () => {
    const written = fakeDataTransfer();
    writeStickerDrag(written, "heart");

    expect([
      readStickerDrag(written),
      readStickerDrag(fakeDataTransfer({ [STICKER_DRAG_TYPE]: "unicorn" })),
      readStickerDrag(fakeDataTransfer({ "text/plain": "heart" })),
    ]).toEqual(["heart", null, null]);
  });
});
