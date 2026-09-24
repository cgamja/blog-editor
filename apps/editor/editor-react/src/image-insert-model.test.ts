import { IMAGE_MAX_BYTES } from "@blog-editor/content-schema";
import {
  fitWithin,
  imageAttrsFrom,
  nextQuality,
  passesThrough,
  uploadErrorMessage,
} from "./image-insert-model";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";

const KB = 1024;

describe("editor-image-insert: 브라우저가 이미지를 한도 안으로 줄여서 올린다", () => {
  it("WHEN 4000×3000 · 1200×2400 · 800×600을 줄인다 THEN 1600×1200 · 800×1600 · 800×600이다", () => {
    expect(fitWithin({ width: 4000, height: 3000 })).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin({ width: 1200, height: 2400 })).toEqual({ width: 800, height: 1600 });
    expect(fitWithin({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });

  it("WHEN 첫 품질 · 0.85 다음 · 0.55 다음을 묻는다 THEN 0.85 · 0.75 · null이다", () => {
    expect(nextQuality(null)).toBe(0.85);
    expect(nextQuality(0.85)).toBe(0.75);
    expect(nextQuality(0.55)).toBeNull();
  });

  it("WHEN 500KB 800×600 GIF · 2MB GIF · 2000×100 GIF · 500KB PNG를 판정한다 THEN 첫 GIF만 원본 통과다", () => {
    const small = { width: 800, height: 600 };
    expect(passesThrough({ type: "image/gif", size: 500 * KB }, small)).toBe(true);
    expect(passesThrough({ type: "image/gif", size: IMAGE_MAX_BYTES * 2 }, small)).toBe(false);
    expect(passesThrough({ type: "image/gif", size: 500 * KB }, { width: 2000, height: 100 })).toBe(
      false,
    );
    expect(passesThrough({ type: "image/png", size: 500 * KB }, small)).toBe(false);
  });
});

describe("editor-image-insert: 올리기 응답과 오류를 에디터가 읽는다", () => {
  it("WHEN 응답 { path, naturalWidth, naturalHeight } THEN alt 빈 image attrs이고 경로 규칙 밖이면 null이다", () => {
    expect(
      imageAttrsFrom({ path: "/images/ab.webp", naturalWidth: 800, naturalHeight: 600 }),
    ).toEqual({ src: "/images/ab.webp", alt: "", naturalWidth: 800, naturalHeight: 600 });
    expect(
      imageAttrsFrom({
        path: "https://evil.example/a.webp",
        naturalWidth: 800,
        naturalHeight: 600,
      }),
    ).toBeNull();
    expect(imageAttrsFrom({ path: "/images/ab.webp" })).toBeNull();
  });

  it("WHEN 413(message 있음) · 401 · 500을 문장으로 바꾼다 THEN API 문장 · 로그인이 필요해요 · 일반 실패 문장이다", () => {
    expect(uploadErrorMessage(413, { message: "이미지는 1MB 이하만 올릴 수 있다" })).toBe(
      "이미지는 1MB 이하만 올릴 수 있다",
    );
    expect(uploadErrorMessage(401, { message: "로그인이 필요하다" })).toBe(
      IMAGE_INSERT_MESSAGES.loginRequired,
    );
    expect(uploadErrorMessage(500, null)).toBe(IMAGE_INSERT_MESSAGES.uploadFailed);
  });
});
