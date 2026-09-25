import { expect, test, type TestInfo } from "@playwright/test";
import { collectErrors, createDraft, createDraftWithBlocks, logIn } from "./app.test.helpers";

/** 실행 한 번의 저장소를 모든 프로젝트 · 재시도가 같이 쓰므로 주소를 따로 둔다 */
const slugOf = (name: string, testInfo: TestInfo) =>
  `e2e-${name}-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

/** Chromium이 sandbox(allow-scripts 없음) iframe에서 스크립트 실행을 막을 때 찍는 콘솔 오류의 앞부분(#144) */
const SANDBOX_SCRIPT_BLOCKED = "Blocked script execution in 'about:srcdoc'";

test("WHEN 문단 끝에서 Shift+Enter를 누르고 둘째 줄을 친 뒤 미리보기를 열면 THEN 문단 하나 안에 br로 두 줄이 보인다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("hard-break", testInfo);
  await createDraft(page, slug, "줄바꿈", "첫 줄");
  await page.goto(`/posts/${slug}/edit`);
  const errors = collectErrors(page);

  const body = page.getByLabel("본문", { exact: true });
  await body.getByText("첫 줄").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("둘째 줄");
  await expect(body.locator("p br")).toHaveCount(1);
  await expect(body.locator("p")).toHaveCount(1);

  await page.getByRole("button", { name: "미리보기" }).click();
  const preview = page.frameLocator('iframe[title="미리보기"]');
  await expect(preview.locator("p br")).toHaveCount(1);
  await expect(preview.locator("p").first()).toContainText("첫 줄");
  await expect(preview.locator("p").first()).toContainText("둘째 줄");
  expect(errors.filter((error) => !error.includes(SANDBOX_SCRIPT_BLOCKED))).toEqual([]);
});

test("WHEN 강제 줄바꿈이 든 문단 전체를 고르고 굵게 단축키를 누른 뒤 미리보기를 열면 THEN 두 줄 모두 굵고 br은 그대로다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("hard-break-bold", testInfo);
  await createDraftWithBlocks(page, slug, "줄바꿈 굵게", [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "첫 줄" },
        { type: "hardBreak" },
        { type: "text", text: "둘째 줄" },
      ],
    },
  ]);
  await page.goto(`/posts/${slug}/edit`);

  const body = page.getByLabel("본문", { exact: true });
  await body.getByText("첫 줄").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ControlOrMeta+B");
  // 에디터 안에서는 굵게가 강제 줄바꿈에도 실려 strong 하나가 br을 감쌀 수 있다(저장 경계가 지운다) — 두 줄이 굵은지만 본다
  await expect(body.locator("p strong").first()).toContainText("첫 줄");
  await expect(body.locator("p strong").last()).toContainText("둘째 줄");

  await page.getByRole("button", { name: "미리보기" }).click();
  const preview = page.frameLocator('iframe[title="미리보기"]');
  await expect(preview.locator("p strong")).toHaveText(["첫 줄", "둘째 줄"]);
  await expect(preview.locator("p br")).toHaveCount(1);
});

test("WHEN 강제 줄바꿈이 든 글자를 끌어 제목 글자 사이에 놓으면 THEN 제목이 나뉘지 않고 두 줄이 공백 하나로 이어진다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("hard-break-drag", testInfo);
  await createDraftWithBlocks(page, slug, "줄바꿈 끌기", [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "제목" }] },
    {
      type: "paragraph",
      content: [{ type: "text", text: "가" }, { type: "hardBreak" }, { type: "text", text: "나" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "끝" }] },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  await expect(body.locator("h2")).toHaveText("제목");

  // 가 · 줄바꿈 · 나를 고른다(제목 0..4 뒤 문단 글자 5..8)
  await body.locator("h2").click();
  await page.evaluate(
    "document.querySelector('.ProseMirror').editor.commands.setTextSelection({ from: 5, to: 8 })",
  );
  // e2e 타입 검사(tsconfig.e2e)에는 DOM lib이 없다 — 글자 자리는 식 문자열로 잰다
  const rectOf = (selector: string, offset: number) =>
    page.evaluate(`(() => {
      const text = document.querySelector('.ProseMirror ${selector}').firstChild;
      const range = document.createRange();
      range.setStart(text, ${offset});
      range.setEnd(text, ${offset + 1});
      const r = range.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, right: r.right };
    })()`) as Promise<{ x: number; y: number; right: number }>;
  const from = await rectOf("h2 + p", 0);
  const into = await rectOf("h2", 0);
  // Playwright 마우스는 contenteditable의 글자 끌기(네이티브 드래그)를 시작하지 못해 글자 고르기가 된다 — 실제 좌표를 실은
  // DragEvent를 보낸다. prosemirror-view 1.42.5의 dragstart · drop 처리(posAtCoords · dropPoint)와 플러그인은 그대로 돈다
  await page.evaluate(`(() => {
    const pm = document.querySelector('.ProseMirror');
    const dataTransfer = new DataTransfer();
    const fire = (el, type, x, y) =>
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer }));
    const source = pm.querySelector('h2 + p');
    const target = pm.querySelector('h2');
    fire(source, 'dragstart', ${from.x}, ${from.y});
    fire(target, 'dragover', ${into.right - 1}, ${into.y});
    fire(target, 'drop', ${into.right - 1}, ${into.y});
    fire(source, 'dragend', ${into.right - 1}, ${into.y});
  })()`);

  await expect(body.locator("h2")).toHaveCount(1);
  await expect(body.locator("h2")).toContainText("가 나");
  await expect(body.locator("h2 br")).toHaveCount(0);
});
