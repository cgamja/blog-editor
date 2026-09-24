import { probeImage } from "./image-probe";
import {
  gifBytes,
  jpegBytes,
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
});
