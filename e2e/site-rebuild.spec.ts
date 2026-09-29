import { expect, test, type TestInfo } from "@playwright/test";
import { createDraft, logIn } from "./app.test.helpers";

// 편집 화면이 사이트 반영 실패를 알리고 다시 시도할 수 있다(openspec site-rebuild)
// 재빌드 상태 · 다시 시도는 네트워크 경계(page.route)에서 가짜로 둔다 — 실제 훅은 배포 밖이다
const FAILED_AT = "2026-09-29T01:00:30.000Z";
const SENT_AT = "2026-09-29T01:01:00.000Z";

const slugOf = (testInfo: TestInfo) =>
  `e2e-site-rebuild-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

// 시나리오 "실패하면 배너가 뜬다" → "다시 시도가 성공하면 배너가 사라진다"를 한 흐름으로 본다 — 둘째가 첫째의 화면에서 시작한다
test("WHEN 재빌드 상태가 failed인 편집 화면에서 다시 시도를 누르고 훅이 2xx를 주면 THEN 실패 배너가 보였다가 사라진다", async ({
  page,
}, testInfo) => {
  let retried = false;
  await page.route("**/api/site-rebuild", async (route) => {
    if (route.request().method() === "POST") retried = true;
    await route.fulfill({
      json: retried
        ? { status: "sent", updatedAt: SENT_AT }
        : { status: "failed", updatedAt: FAILED_AT },
    });
  });
  await logIn(page);
  const slug = slugOf(testInfo);
  await createDraft(page, slug, "재빌드 배너를 확인하는 글");

  await page.goto(`/posts/${slug}/edit`);
  const failure = page.getByText("사이트 반영 실패");
  const retry = page.getByRole("button", { name: "다시 시도" });

  await expect(failure).toBeVisible();
  await expect(retry).toBeVisible();

  await retry.click();

  await expect(failure).toBeHidden();
  await expect(retry).toBeHidden();
  expect(retried).toBe(true);
});
