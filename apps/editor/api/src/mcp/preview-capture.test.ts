import { readFileSync } from "node:fs";
import { fixtures } from "@blog-editor/content-schema";
import type { PostFile } from "@blog-editor/content-schema";
import type { ImageStore } from "../image-store";
import { createMemoryImageStore } from "../memory-image-store";
import { capturePreview } from "./preview-capture";
import { previewPageHtml } from "./preview-page";

// 실제 Chromium(playwright-core, e2e와 같은 설치본)으로 찍는다 — 띄우는 시간을 넉넉히 둔다
const BROWSER_TIMEOUT_MS = 60_000;
const IMAGE_BASE_URL = "https://simsimeestudio.com";
const IMAGE_NAME = "0123456789abcdef0123456789abcdef.png";
const postCss = readFileSync(
  new URL(import.meta.resolve("@blog-editor/content-render/post.css")),
  "utf8",
);

const WITH_IMAGE: PostFile = {
  ...fixtures.minimal,
  doc: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "올린 사진이 있는 초안." }] },
      { type: "image", attrs: { src: `/images/${IMAGE_NAME}`, alt: "사진" } },
    ],
  },
};

/**
 * 저장소가 읽기에서 실패하는 경우(디스크 오류 등) — 가짜 저장소를 새로 만들지 않고 실제 메모리 저장소를 감싸 get만 던지게 한다.
 * 브라우저 요청 가로채기 안의 예외가 처리되지 않은 거부로 새면 api 프로세스가 죽는다.
 */
function failingGetStore(): ImageStore {
  const store = createMemoryImageStore();
  return { ...store, get: () => Promise.reject(new Error("디스크 읽기 실패")) };
}

describe("mcp-drafts — preview_post 찍기", () => {
  it(
    "WHEN 올린 이미지 저장소 읽기가 실패하는 초안을 찍으면 THEN 이미지 없이 두 장을 돌려주고 처리되지 않은 거부가 없다",
    async () => {
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on("unhandledRejection", onUnhandled);
      try {
        const html = previewPageHtml(WITH_IMAGE, { imageBaseUrl: IMAGE_BASE_URL, postCss });

        const result = await capturePreview(html, 1, {
          imageBaseUrl: IMAGE_BASE_URL,
          images: failingGetStore(),
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(result.ok).toBe(true);
        expect(result.ok && result.images.desktop !== null && result.images.mobile !== null).toBe(
          true,
        );
        expect(unhandled).toEqual([]);
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
    },
    BROWSER_TIMEOUT_MS,
  );

  it("WHEN 브라우저 실행 파일이 없으면 THEN 설치 안내로 이어지는 browserMissing이다", async () => {
    // playwright-core가 실행 파일을 못 찾을 때 내는 문장 모양(lib/coreBundle.js "Executable doesn't exist at …")
    const launch = () =>
      Promise.reject(new Error("browserType.launch: Executable doesn't exist at /nowhere/chrome"));

    const result = await capturePreview(
      "<p>안녕</p>",
      1,
      { imageBaseUrl: IMAGE_BASE_URL },
      {
        launch,
      },
    );

    expect(result).toEqual({ ok: false, reason: "browserMissing" });
  });
});
