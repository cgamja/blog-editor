import { expect, test, type TestInfo } from "@playwright/test";
import { collectErrors, createDraft, createDraftWithBlocks, logIn } from "./app.test.helpers";

/** 실행 한 번의 저장소를 모든 프로젝트 · 재시도가 같이 쓰므로 주소를 따로 둔다 */
const slugOf = (name: string, testInfo: TestInfo) =>
  `e2e-${name}-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

/**
 * Playwright 추적(use.trace: "retain-on-failure" — 성공해도 기록은 늘 켜진다)의 스냅숏 수집기가 모든 프레임의 main world에
 * 스크립트를 넣고(addInitScript) 동작마다 captureSnapshot을 평가한다. allow-scripts 없는 미리보기 iframe(sandbox)은 이를 막고
 * 이 문구를 콘솔 오류로 찍는다(Chromium · WebKit). 앱이 아니라 테스트 도구가 원인이라 걸러 둔다 — 추적을 끄면 0건이고, 미리보기
 * 문서에는 스크립트가 없다(#144 실험). sandbox에 allow-scripts를 더해 없애지 않는다(보안 경계).
 * https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/trace/recorder/snapshotter.ts
 */
const SANDBOX_SCRIPT_BLOCKED = "Blocked script execution in 'about:srcdoc'";

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const WIDE_COLUMNS = 8;

test("WHEN 빈 문단에 /표를 치고 Enter, 칸에 이름 · 값 · 가를 Tab으로 옮겨 치고 미리보기를 열면 THEN 미리보기에 th 둘과 td 가가 있는 표가 보인다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("table-slash", testInfo);
  await createDraft(page, slug, "표 넣기", "표 앞 문단");
  await page.goto(`/posts/${slug}/edit`);
  const errors = collectErrors(page);

  const body = page.getByLabel("본문", { exact: true });
  await body.getByText("표 앞 문단").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/표");
  await expect(page.getByRole("option", { name: "표" })).toBeVisible();
  await page.keyboard.press("Enter");

  await page.keyboard.type("이름");
  await page.keyboard.press("Tab");
  await page.keyboard.type("값");
  await page.keyboard.press("Tab");
  await page.keyboard.type("가");
  await expect(body.locator("table td")).toHaveCount(4);

  await page.getByRole("button", { name: "미리보기" }).click();
  const preview = page.frameLocator('iframe[title="미리보기"]');
  await expect(preview.locator("thead th")).toHaveText(["이름", "값"]);
  await expect(preview.locator("tbody td").first()).toHaveText("가");
  // 스크립트를 막은 미리보기 iframe(sandbox)에서 나는 알려진 경고만 뺀다 — 테스트 도구(추적) 탓이다(SANDBOX_SCRIPT_BLOCKED 주석)
  expect(errors.filter((error) => !error.includes(SANDBOX_SCRIPT_BLOCKED))).toEqual([]);
});

test("WHEN 375px 폭에서 열이 많은 표가 든 글의 편집 화면을 열면 THEN 페이지는 가로로 넓어지지 않고 표 틀만 가로로 스크롤한다", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await logIn(page);
  const slug = slugOf("table-narrow", testInfo);
  const row = (prefix: string) => ({
    type: "tableRow",
    content: Array.from({ length: WIDE_COLUMNS }, (_, column) => ({
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `${prefix} 열 ${column + 1} 긴 칸 글자` }],
        },
      ],
    })),
  });
  await createDraftWithBlocks(page, slug, "넓은 표", [
    { type: "table", content: [row("머리"), row("본문")] },
  ]);
  await page.goto(`/posts/${slug}/edit`);

  const frame = page.getByLabel("본문", { exact: true }).locator(".post-table-scroll");
  await expect(frame).toBeVisible();
  // e2e 타입 검사(tsconfig.e2e)에는 DOM lib이 없다 — 페이지 쪽은 식 문자열로, 틀은 필요한 모양만 적어 잰다
  const pageOverflow = (await page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  )) as number;
  const frameOverflow = await frame.evaluate(
    (el: { scrollWidth: number; clientWidth: number }) => el.scrollWidth - el.clientWidth,
  );
  expect(pageOverflow).toBeLessThanOrEqual(0);
  expect(frameOverflow).toBeGreaterThan(0);
});
