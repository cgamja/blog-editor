import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createDraftWithBlocks, editDraftElsewhere, logIn } from "./app.test.helpers";

// 열린 편집 화면이 다른 곳(AI의 MCP 도구)에서 바뀐 초안을 알아챈다(openspec editor-live-reflect)
const FIRST = "첫 문단은 그대로 둔다.";
const SECOND = "둘째 문단은 다른 곳에서 고쳐진다.";
const SECOND_BY_AI = "AI가 다른 곳에서 고친 둘째 문단이다.";
const TYPED = "내가 친 글자";
const BANNER_TEXT = "AI가 고쳤어요";
// 바뀐 최상위 블록 칠하기의 표시 — 칠하기는 보기만의 것이라 역할 · 이름이 없다(구현 계약: Decoration.node 속성)
const CHANGED_BLOCK = "[data-live-changed]";

const slugOf = (name: string, testInfo: TestInfo) =>
  `e2e-live-${name}-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

async function openDraft(page: Page, slug: string): Promise<void> {
  await createDraftWithBlocks(page, slug, "다른 곳에서 고쳐지는 초안", [
    { type: "paragraph", content: [{ type: "text", text: FIRST }] },
    { type: "paragraph", content: [{ type: "text", text: SECOND }] },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  await expect(page.getByLabel("본문", { exact: true })).toContainText(SECOND);
}

const editSecondParagraph = (page: Page, slug: string) =>
  editDraftElsewhere(page, slug, (file) => {
    file.doc.content[1] = { type: "paragraph", content: [{ type: "text", text: SECOND_BY_AI }] };
  });

/** 창에 돌아온 것처럼 알린다 — 주기 확인을 기다리지 않고 "창에 돌아올 때" 확인을 부른다 */
async function returnToWindow(page: Page): Promise<void> {
  // 문자열로 넘긴다 — tsconfig.e2e.json에 DOM lib이 없다(다른 spec과 같은 관례)
  await page.evaluate(`(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  })()`);
}

async function typeAtBodyEnd(page: Page, text: string): Promise<void> {
  await page.getByLabel("본문", { exact: true }).getByText(FIRST).click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

test("WHEN 손대지 않은 편집 화면을 연 채 다른 곳에서 둘째 문단을 고치면 THEN 본문이 새 글로 바뀌고 둘째 문단이 칠해지며, 이어서 저장해도 충돌이 없다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("clean", testInfo);
  await openDraft(page, slug);
  const body = page.getByLabel("본문", { exact: true });

  await editSecondParagraph(page, slug);
  await returnToWindow(page);

  await expect(body).toContainText(SECOND_BY_AI);
  await expect(body.locator(CHANGED_BLOCK)).toHaveText([SECOND_BY_AI]);

  await typeAtBodyEnd(page, TYPED);
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText(/^초안 저장됨/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("WHEN 저장 안 한 고침이 있는 채 다른 곳에서 초안을 고치면 THEN 본문은 그대로이고 띠가 보이며, 「불러오기」를 누르면 새 글로 바뀐다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("dirty", testInfo);
  await openDraft(page, slug);
  const body = page.getByLabel("본문", { exact: true });

  // 자동 저장(2초)이 돌기 전에 다른 곳의 고침을 알아채야 저장 안 한 고침이 있는 상태다
  await typeAtBodyEnd(page, TYPED);
  await editSecondParagraph(page, slug);
  await returnToWindow(page);

  const banner = page.getByRole("alert").filter({ hasText: BANNER_TEXT });
  await expect(banner).toBeVisible();
  // 띠는 불러오면 지금 고친 내용이 사라진다고 알린다
  await expect(banner).toContainText("사라");
  await expect(body).toContainText(TYPED);
  await expect(body).toContainText(SECOND);

  await banner.getByRole("button", { name: "불러오기" }).click();

  await expect(body).toContainText(SECOND_BY_AI);
  await expect(body).not.toContainText(TYPED);
  await expect(banner).toBeHidden();
});

test("WHEN 편집 화면에서 고치고 저장하면 THEN 자기 저장이라 띠도 칠하기도 없다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("own-save", testInfo);
  await openDraft(page, slug);
  const body = page.getByLabel("본문", { exact: true });

  await typeAtBodyEnd(page, TYPED);
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText(/^초안 저장됨/)).toBeVisible();
  await returnToWindow(page);

  await expect(page.getByRole("alert").filter({ hasText: BANNER_TEXT })).toHaveCount(0);
  await expect(body.locator(CHANGED_BLOCK)).toHaveCount(0);
  await expect(body).toContainText(TYPED);
});
