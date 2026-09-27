import { expect, test, type TestInfo } from "@playwright/test";
import { collectErrors, createDraftWithBlocks, logIn } from "./app.test.helpers";

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

/** 체크 칸은 할 일 항목 요소의 왼쪽 여백(글 문단 앞)에 그린다 — 그 자리를 누른다 */
const CHECKBOX_SPOT = { x: 6, y: 10 };

test("WHEN 할 일 항목의 체크 칸 자리를 누른 뒤 미리보기를 열면 THEN 항목이 체크되고 미리보기에 체크된 체크 칸이 보인다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("task-list-toggle", testInfo);
  await createDraftWithBlocks(page, slug, "할 일 누르기", [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: "우유 사기" }] }],
        },
      ],
    },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const errors = collectErrors(page);

  const body = page.getByLabel("본문", { exact: true });
  const task = body.locator("li[data-checked]");
  await expect(task).toHaveAttribute("data-checked", "false");
  await task.click({ position: CHECKBOX_SPOT });
  await expect(task).toHaveAttribute("data-checked", "true");
  await expect(task).toContainText("우유 사기");
  await page.screenshot({ path: testInfo.outputPath("task-list-toggle.png") });

  await page.getByRole("button", { name: "미리보기" }).click();
  const preview = page.frameLocator('iframe[title="미리보기"]');
  await expect(preview.locator('li.post-task input[type="checkbox"]')).toBeChecked();
  await expect(preview.locator("li.post-task")).toContainText("우유 사기");
  expect(errors.filter((error) => !error.includes(SANDBOX_SCRIPT_BLOCKED))).toEqual([]);
});

test("WHEN 빈 문단에서 - [ ] 우유를 친다 THEN 체크하지 않은 할 일 항목 하나인 점 목록이 되고 글은 우유다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("task-list-type", testInfo);
  await createDraftWithBlocks(page, slug, "할 일 치기", [{ type: "paragraph" }]);
  await page.goto(`/posts/${slug}/edit`);

  const body = page.getByLabel("본문", { exact: true });
  await body.locator("p").first().click();
  await page.keyboard.type("- [ ] 우유");

  const task = body.locator("ul > li[data-checked]");
  await expect(task).toHaveCount(1);
  await expect(task).toHaveAttribute("data-checked", "false");
  await expect(task).toHaveText("우유");
});

test("WHEN 안쪽 목록이 있는 할 일 항목에서 첫 줄보다 아래(안쪽 목록 높이)의 왼쪽 여백을 누른다 THEN 바깥 항목의 체크가 그대로다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("task-list-nested-margin", testInfo);
  await createDraftWithBlocks(page, slug, "안쪽 목록 여백", [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          attrs: { checked: false },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "장보기" }] },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "우유" }] }],
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  await page.goto(`/posts/${slug}/edit`);

  const body = page.getByLabel("본문", { exact: true });
  const task = body.locator("li[data-checked]");
  await expect(task).toHaveAttribute("data-checked", "false");
  const taskBox = await task.boundingBox();
  const nestedBox = await task.locator("ul").boundingBox();
  if (taskBox === null || nestedBox === null)
    throw new Error("할 일 항목 · 안쪽 목록이 화면에 없다");
  await task.click({
    position: { x: CHECKBOX_SPOT.x, y: nestedBox.y + nestedBox.height / 2 - taskBox.y },
  });

  await expect(task).toHaveAttribute("data-checked", "false");
});

test("WHEN 여러 줄로 꺾인 할 일 항목에서 둘째 줄 옆 왼쪽 여백을 누른다 THEN 체크가 그대로다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("task-list-wrapped-line", testInfo);
  const longText = "줄이 꺾이도록 긴 할 일 항목의 글이다. ".repeat(12);
  await createDraftWithBlocks(page, slug, "여러 줄 할 일", [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          attrs: { checked: false },
          content: [{ type: "paragraph", content: [{ type: "text", text: longText }] }],
        },
      ],
    },
  ]);
  await page.goto(`/posts/${slug}/edit`);

  const body = page.getByLabel("본문", { exact: true });
  const task = body.locator("li[data-checked]");
  await expect(task).toHaveAttribute("data-checked", "false");
  const taskBox = await task.boundingBox();
  const paragraphBox = await task.locator("p").boundingBox();
  if (taskBox === null || paragraphBox === null) throw new Error("할 일 항목이 화면에 없다");
  // 문단이 적어도 두 줄이어야 둘째 줄 옆을 누를 수 있다 — 첫 줄은 CHECKBOX_SPOT.y 근처다
  expect(paragraphBox.height).toBeGreaterThan(CHECKBOX_SPOT.y * 4);
  await task.click({
    position: { x: CHECKBOX_SPOT.x, y: paragraphBox.y + paragraphBox.height - 4 - taskBox.y },
  });

  await expect(task).toHaveAttribute("data-checked", "false");
});
