import { expect, test, type TestInfo } from "@playwright/test";
import { collectErrors, createDraftWithBlocks, logIn } from "./app.test.helpers";

/** 실행 한 번의 저장소를 모든 프로젝트 · 재시도가 같이 쓰므로 주소를 따로 둔다 */
const slugOf = (name: string, testInfo: TestInfo) =>
  `e2e-${name}-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

/** Chromium이 sandbox(allow-scripts 없음) iframe에서 스크립트 실행을 막을 때 찍는 콘솔 오류의 앞부분(#144) */
const SANDBOX_SCRIPT_BLOCKED = "Blocked script execution in 'about:srcdoc'";

test("WHEN 둘째 문단을 고르고 꾸미기 패널에서 간격 「넓게」를 누른 뒤 미리보기를 열면 THEN 그 문단이 data-space=lg 래퍼로 보이고 위 여백이 기본보다 넓다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("spacing", testInfo);
  await createDraftWithBlocks(page, slug, "간격", [
    { type: "paragraph", content: [{ type: "text", text: "첫 문단" }] },
    { type: "paragraph", content: [{ type: "text", text: "둘째 문단" }] },
    { type: "paragraph", content: [{ type: "text", text: "셋째 문단" }] },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const errors = collectErrors(page);

  const body = page.getByLabel("본문", { exact: true });
  await body.getByText("둘째 문단").click();
  await page.getByRole("tab", { name: "꾸미기" }).click();
  await page.getByRole("button", { name: "간격 넓게" }).click();
  await expect(page.getByRole("button", { name: "간격 넓게" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(body.locator('div.post-block[data-space="lg"]')).toContainText("둘째 문단");

  // 간격은 블록 위 여백이다 — 문단 끝에서 Enter로 이어 쓴 새 문단은 간격을 물려받지 않는다
  await body.getByText("둘째 문단").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("이어 쓴 문단");
  await expect(body.locator("p", { hasText: "이어 쓴 문단" })).toBeVisible();
  await expect(body.locator("[data-space]")).toHaveCount(1);

  await page.getByRole("button", { name: "미리보기" }).click();
  const preview = page.frameLocator('iframe[title="미리보기"]');
  const spaced = preview.locator('.post-body > [data-space="lg"]');
  await expect(spaced).toContainText("둘째 문단");
  const first = preview.locator(".post-body > p", { hasText: "첫 문단" });
  const next = preview.locator(".post-body > p", { hasText: "이어 쓴 문단" });
  // 블록 사이 틈(앞 블록 아래 ~ 이 블록 위)을 잰다 — 간격 lg 위 틈이 기본 리듬(이어 쓴 문단 위 틈)보다 넓다
  const box = async (locator: typeof spaced) => {
    const found = await locator.boundingBox();
    if (found === null) throw new Error("블록이 보이지 않는다");
    return found;
  };
  const [firstBox, spacedBox, nextBox] = [await box(first), await box(spaced), await box(next)];
  const gapAboveSpaced = spacedBox.y - (firstBox.y + firstBox.height);
  const gapAboveNext = nextBox.y - (spacedBox.y + spacedBox.height);
  expect(gapAboveSpaced).toBeGreaterThan(gapAboveNext * 1.5);
  expect(errors.filter((error) => !error.includes(SANDBOX_SCRIPT_BLOCKED))).toEqual([]);
});
