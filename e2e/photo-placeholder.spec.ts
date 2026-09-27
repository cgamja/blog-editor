import { expect, test } from "@playwright/test";
import { collectErrors, createDraftWithBlocks, logIn } from "./app.test.helpers";

const BRIEF = "잠든 아기 옆 어두운 낮잠 방";
const NEW_BRIEF = "잠든 아기 옆 커튼 친 낮잠 방";
/** 4×3 불투명 PNG — 브라우저가 풀어 다시 굽는다(encode-image) */
const PNG_4X3 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGM4UREARww4OQBzdhLBZPAGSAAAAABJRU5ErkJggg==",
  "base64",
);

interface SavedImage {
  type: string;
  attrs: { alt?: string; brief?: string };
}

test("WHEN 사진 자리를 고르고 「사진 올리기」로 이미지를 올린 뒤 그림의 「사진 설명」을 열어 고친다 THEN 그림이 되고 원래 설명이 보이며 저장된 brief가 바뀐다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const errors = collectErrors(page);
  const slug = `e2e-photo-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraftWithBlocks(page, slug, "사진 자리 채우기", [
    { type: "paragraph", content: [{ type: "text", text: "낮잠 이야기" }] },
    { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3" } },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  const placeholder = body.locator("figure.photo-placeholder");
  await expect(placeholder).toContainText(BRIEF);
  await page.screenshot({ path: testInfo.outputPath("placeholder.png") });

  await placeholder.click();
  const bar = page.getByRole("toolbar", { name: "사진 자리" });
  const chooser = page.waitForEvent("filechooser");
  await bar.getByRole("button", { name: "사진 올리기" }).click();
  await (await chooser).setFiles({ name: "nap.png", mimeType: "image/png", buffer: PNG_4X3 });

  const image = body.locator("figure.post-image img");
  await expect(image).toHaveAttribute("alt", BRIEF);
  await expect(placeholder).toHaveCount(0);

  await image.click();
  const toolbar = page.getByRole("toolbar", { name: "사진 폭" });
  await toolbar.getByRole("button", { name: /사진 설명/ }).click();
  const input = page.getByRole("textbox", { name: /사진 설명/ });
  await expect(input).toHaveValue(BRIEF);
  await page.screenshot({ path: testInfo.outputPath("image-brief.png") });
  await input.fill(NEW_BRIEF);
  await input.press("Enter");

  await expect
    .poll(async () =>
      page.evaluate(async (slug) => {
        const saved = (await (await fetch(`/api/posts/${slug}`)).json()) as {
          doc: { content: SavedImage[] };
        };
        return saved.doc.content.find((block) => block.type === "image")?.attrs ?? null;
      }, slug),
    )
    .toMatchObject({ alt: BRIEF, brief: NEW_BRIEF });
  expect(errors).toEqual([]);
});
