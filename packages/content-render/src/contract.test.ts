/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createPublicPostsResponseSchema, fixtures } from "@blog-editor/content-schema";
import type { Fixtures } from "@blog-editor/content-schema";
import { renderHtml } from "./render";

// 사이트 BLOG_CATEGORIES와 같은 목록 — 계약 픽스처의 category가 사이트 enum 안에 있어야 한다
const SITE_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const SLUGS: Record<keyof Fixtures, string> = {
  minimal: "beta-open",
  allBlocks: "feature-tour",
  decorationMax: "decoration-max",
};
const CONTRACT_DIR = "../../../contract/public-api/public";
const IMAGE_BASE_URL = "https://simsimeestudio.com";
const POST_CSS_URL = "/public/post.css";

/** M1 API 핸들러가 생기기 전의 계약 — 핸들러가 생기면 이 함수 대신 핸들러 출력을 비교한다. */
function contractResponse(): unknown {
  const posts = (Object.keys(SLUGS) as (keyof Fixtures)[]).map((name) => {
    const file = fixtures[name];
    const { title, description, date, updated, category, image } = file.meta;
    return {
      slug: SLUGS[name],
      title,
      description,
      date,
      ...(updated === undefined ? {} : { updated }),
      category,
      draft: false,
      ...(image === undefined ? {} : { image: new URL(image, IMAGE_BASE_URL).href }),
      html: renderHtml(file, { imageBaseUrl: IMAGE_BASE_URL }),
    };
  });
  return { postCssUrl: POST_CSS_URL, posts };
}

describe("public-posts-contract", () => {
  it("WHEN 대표 픽스처 3개로 응답을 만들면 THEN 스키마를 통과하고 계약 픽스처 · post.css 사본과 같다", async () => {
    const response = contractResponse();
    const schema = createPublicPostsResponseSchema({ categories: SITE_CATEGORIES });
    // parse — 어긋나면 ZodError가 어느 필드인지 보여 준다
    schema.parse(response);
    await expect(`${JSON.stringify(response, null, 2)}\n`).toMatchFileSnapshot(
      `${CONTRACT_DIR}/posts`,
    );
    await expect(readFileSync(new URL("./post.css", import.meta.url), "utf8")).toMatchFileSnapshot(
      `${CONTRACT_DIR}/post.css`,
    );
  });
});
