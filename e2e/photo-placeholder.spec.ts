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

test("WHEN 사진 자리에 올린 이미지가 서버에 닿지 못해 실패하고 「다시 시도」를 누른다 THEN 그림이 사진 자리를 채우고 사진 자리 · 앞에 새 그림이 남지 않는다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const errors = collectErrors(page);
  const slug = `e2e-photo-retry-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraftWithBlocks(page, slug, "사진 자리 다시 시도", [
    { type: "paragraph", content: [{ type: "text", text: "낮잠 이야기" }] },
    { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3" } },
  ]);
  let uploads = 0;
  // 첫 올리기만 연결을 끊는다 — 다시 시도는 실제 API로 간다
  await page.route("**/api/images", async (route) => {
    uploads += 1;
    if (uploads === 1) await route.abort("failed");
    else await route.continue();
  });
  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  const placeholder = body.locator("figure.photo-placeholder");
  await placeholder.click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("toolbar", { name: "사진 자리" })
    .getByRole("button", { name: "사진 올리기" })
    .click();
  await (await chooser).setFiles({ name: "nap.png", mimeType: "image/png", buffer: PNG_4X3 });

  await body.getByRole("alert").getByRole("button", { name: "다시 시도" }).click();

  const images = body.locator("figure.post-image img");
  await expect(images).toHaveCount(1);
  await expect(images).toHaveAttribute("alt", BRIEF);
  await expect(placeholder).toHaveCount(0);
  // 끊긴 올리기가 콘솔에 남기는 네트워크 오류는 이 시나리오의 일부다
  expect(errors.filter((error) => !error.includes("net::"))).toEqual([]);
});

/** 브라우저 쪽 전역 — e2e tsconfig에는 DOM 타입이 없어 필요한 모양만 적는다 */
interface ClipboardRecorder {
  __copied: string[];
  navigator: { clipboard: { writeText: (text: string) => Promise<void> } };
}

const PROMPT = "A sleeping baby in a dim nursery, soft window light, 35mm film photo";

test("WHEN 비율 4:3 · 프롬프트가 있는 사진 자리에서 「이미지 프롬프트」를 열어 보고 「프롬프트 복사」를 누른다 THEN 프롬프트가 보이고 클립보드에 프롬프트 뒤 --ar 4:3이 붙은 글이 있다", async ({
  page,
}, testInfo) => {
  // 클립보드 읽기 권한은 chromium만 줄 수 있다 — 두 엔진 모두 같은 방법으로 보려고 쓰기 호출을 받아 적는다
  await page.addInitScript(() => {
    const browser = globalThis as unknown as ClipboardRecorder;
    browser.__copied = [];
    browser.navigator.clipboard.writeText = async (text) => {
      browser.__copied.push(text);
    };
  });
  await logIn(page);
  const errors = collectErrors(page);
  const slug = `e2e-photo-prompt-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraftWithBlocks(page, slug, "사진 자리 프롬프트 복사", [
    { type: "paragraph", content: [{ type: "text", text: "낮잠 이야기" }] },
    { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3", prompt: PROMPT } },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  await body.locator("figure.photo-placeholder").click();
  const bar = page.getByRole("toolbar", { name: "사진 자리" });

  await bar.getByRole("button", { name: /이미지 프롬프트/ }).click();
  await expect(page.getByRole("textbox", { name: /이미지 프롬프트/ })).toHaveValue(PROMPT);
  await bar.getByRole("button", { name: "프롬프트 복사" }).click();

  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as ClipboardRecorder).__copied))
    .toEqual([`${PROMPT} --ar 4:3`]);
  expect(errors).toEqual([]);
});

test("WHEN 프롬프트 없는 그림을 골라 「이미지 프롬프트」 빈 칸에 프롬프트를 쓰고 Enter를 누른다 THEN 저장된 그림이 그 prompt를 가진다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = `e2e-image-prompt-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraftWithBlocks(page, slug, "그림에 프롬프트 넣기", [
    { type: "paragraph", content: [{ type: "text", text: "낮잠 이야기" }] },
    {
      type: "image",
      attrs: { src: "/images/cherry-walk.webp", alt: "", naturalWidth: 800, naturalHeight: 600 },
    },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  await body.locator("figure.post-image").click();
  const toolbar = page.getByRole("toolbar", { name: "사진 폭" });

  await toolbar.getByRole("button", { name: /이미지 프롬프트/ }).click();
  const input = page.getByRole("textbox", { name: /이미지 프롬프트/ });
  await expect(input).toHaveValue("");
  await expect(toolbar.getByRole("button", { name: "프롬프트 복사" })).toHaveCount(0);
  await input.fill(PROMPT);
  await input.press("Enter");

  await expect
    .poll(async () =>
      page.evaluate(async (slug) => {
        const saved = (await (await fetch(`/api/posts/${slug}`)).json()) as {
          doc: { content: { type: string; attrs: { prompt?: string } }[] };
        };
        return saved.doc.content.find((block) => block.type === "image")?.attrs.prompt ?? null;
      }, slug),
    )
    .toBe(PROMPT);
});
