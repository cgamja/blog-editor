import { probeImage } from "./image-probe";
import {
  gifBytes,
  jpegBytes,
  exifApp1,
  jpegFrom,
  jpegWithOrientationBytes,
  sof0,
  sos,
  xmpApp1,
  pngBytes,
  svgBytes,
  webpVp8Bytes,
  webpVp8lBytes,
  webpVp8xBytes,
} from "./images.test.helpers";

describe("probeImage", () => {
  it("WHEN 네 형식 헤더를 넣으면 THEN 형식과 가로 · 세로가 헤더에 적힌 값이다", () => {
    expect(probeImage(pngBytes(800, 600))).toEqual({ format: "png", width: 800, height: 600 });
    expect(probeImage(gifBytes(320, 240))).toEqual({ format: "gif", width: 320, height: 240 });
    expect(probeImage(webpVp8Bytes(1600, 900))).toEqual({
      format: "webp",
      width: 1600,
      height: 900,
    });
    expect(probeImage(webpVp8lBytes(1200, 1600))).toEqual({
      format: "webp",
      width: 1200,
      height: 1600,
    });
    expect(probeImage(webpVp8xBytes(1024, 768))).toEqual({
      format: "webp",
      width: 1024,
      height: 768,
    });
    expect(probeImage(jpegBytes(640, 480))).toEqual({ format: "jpeg", width: 640, height: 480 });
  });

  it("WHEN SVG · 잘린 헤더 · 크기 0을 넣으면 THEN 모두 null이다", () => {
    expect(probeImage(svgBytes())).toBeNull();
    expect(probeImage(pngBytes(800, 600).slice(0, 12))).toBeNull();
    expect(probeImage(gifBytes(0, 10))).toBeNull();
    expect(probeImage(new Uint8Array(0))).toBeNull();
  });

  it("WHEN 깨진 JPEG · 잘린 WebP · IHDR 없는 PNG를 넣으면 THEN 끝나고 모두 null이다", () => {
    const zeroLengthSegment = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0x00, 0x00]);
    const onlyFill = new Uint8Array(64).fill(0xff);
    onlyFill[1] = 0xd8;
    const sof = 20;
    const truncatedSof = jpegBytes(640, 480).slice(0, sof + 6);
    const pngWithoutIhdr = pngBytes(800, 600);
    pngWithoutIhdr.set([0x49, 0x44, 0x41, 0x54], 12);

    expect(probeImage(zeroLengthSegment)).toBeNull();
    expect(probeImage(onlyFill)).toBeNull();
    expect(probeImage(truncatedSof)).toBeNull();
    expect(probeImage(webpVp8Bytes(10, 10).slice(0, 27))).toBeNull();
    expect(probeImage(webpVp8lBytes(10, 10).slice(0, 24))).toBeNull();
    expect(probeImage(webpVp8xBytes(10, 10).slice(0, 29))).toBeNull();
    expect(probeImage(pngWithoutIhdr)).toBeNull();
  });

  it("WHEN Orientation 6 EXIF가 든 JPEG를 넣으면 THEN 방향도 돌려준다", () => {
    expect(probeImage(jpegWithOrientationBytes(640, 480, 6))).toEqual({
      format: "jpeg",
      width: 640,
      height: 480,
      orientation: 6,
    });
  });

  it("WHEN Exif APP1이 SOF 뒤에 있으면 THEN 크기와 방향을 함께 읽는다", () => {
    expect(probeImage(jpegFrom(sof0(640, 480), exifApp1(6), sos()))).toEqual({
      format: "jpeg",
      width: 640,
      height: 480,
      orientation: 6,
    });
  });

  it("WHEN 리틀엔디언 Exif · XMP 뒤의 Exif · Orientation 1~4를 넣으면 THEN 그 방향을 돌려준다", () => {
    expect(probeImage(jpegWithOrientationBytes(640, 480, 6, "II"))?.orientation).toBe(6);
    expect(probeImage(jpegFrom(xmpApp1(), exifApp1(6), sof0(640, 480), sos()))?.orientation).toBe(
      6,
    );
    for (const orientation of [1, 2, 3, 4]) {
      expect(probeImage(jpegWithOrientationBytes(640, 480, orientation))?.orientation).toBe(
        orientation,
      );
    }
  });

  it("WHEN IFD 오프셋 · 엔트리 수가 깨진 Exif면 THEN 크래시 없이 끝나고 크기를 돌려준다", () => {
    const size = { format: "jpeg", width: 640, height: 480 };
    const badOffset = jpegFrom(exifApp1(6, { ifdOffset: 0xffffffff }), sof0(640, 480), sos());
    const badCount = jpegFrom(exifApp1(6, { entryCount: 0xffff }), sof0(640, 480), sos());
    expect(probeImage(badOffset)).toEqual(size);
    // 엔트리 수만 부풀린 경우 첫 칸은 온전하니 방향은 읽어도 된다 — 세그먼트 밖을 읽지 않고 끝나는지가 요점
    expect(probeImage(badCount)).toMatchObject(size);
  });
});
