import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createDraft, logIn } from "./app.test.helpers";

const BODY_TEXT = "스티커 붙은 문단";
// 문단 오른쪽 밖(x 100% 넘음)에 둔다 — 글자를 누를 때 스티커 조작 층이 클릭을 가로채지 않게
const STICKERS = [
  { id: "heart", x: 110, y: 50, size: 10, rotate: 0 },
  { id: "star-mint", x: 120, y: 50, size: 10, rotate: 30 },
];

/** 스티커 둘인 문단 하나짜리 초안의 편집 화면을 연다 */
async function openStickerDraft(page: Page, testInfo: TestInfo, name: string) {
  await logIn(page);
  const slug = `e2e-${name}-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraft(page, slug, "스티커 복사", BODY_TEXT, { stickers: STICKERS });
  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  const stickers = body.locator("img.post-sticker");
  await expect(stickers).toHaveCount(STICKERS.length);
  return { body, stickers };
}

// 글자 첫머리 — 스티커(문단 오른쪽 밖)와 겹치지 않는 곳
const TEXT_START = { x: 4, y: 4 };

/**
 * 브라우저 기본 동작으로 선택을 옮기는 키(화살표)를 누르고, 에디터가 옮긴 선택을 읽을 때까지 기다린다.
 * 에디터(ProseMirror DOMObserver)는 selectionchange 이벤트로 DOM 선택을 읽는데, 그 이벤트는 키보다 늦게 온다 —
 * 읽기 전에 다음 키(Enter)가 가면 고른 글자를 지우며 나눈다(병렬 verify 실패 스냅샷). 앞 동작(세 번 클릭)의 늦은
 * selectionchange가 섞일 수 있어 이벤트 하나를 기다리는 것으로는 모자라다. 선택이 접히고(DOM) 그 뒤 프레임과
 * 태스크 하나가 지나(이벤트 처리 기회) 에디터가 읽은 뒤에 넘어간다. 식은 페이지 안에서 돈다 — e2e 타입 검사
 * (tsconfig.e2e)에는 DOM lib이 없어 문자열로 준다.
 */
async function pressMovingSelection(page: Page, key: string) {
  await page.evaluate(
    "window.__e2eSelectionBefore = [document.getSelection()?.anchorNode, document.getSelection()?.anchorOffset]",
  );
  await page.keyboard.press(key);
  await page.waitForFunction(
    "document.getSelection()?.isCollapsed === true && (document.getSelection()?.anchorNode !== window.__e2eSelectionBefore[0] || document.getSelection()?.anchorOffset !== window.__e2eSelectionBefore[1])",
  );
  await page.evaluate(
    "new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))",
  );
}

/** 커서를 문단 끝으로 옮겨 새 빈 문단을 만들고 붙여넣는다 — 실제 클립보드를 거친다 */
async function pasteIntoNewParagraph(page: Page) {
  await pressMovingSelection(page, "ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+V");
}

test("WHEN 스티커 있는 문단을 복사해 같은 글에 붙여넣으면 THEN 붙은 문단에도 같은 수의 스티커가 있다", async ({
  page,
}, testInfo) => {
  const { body, stickers } = await openStickerDraft(page, testInfo, "sticker-copy-all");

  // 복사한 HTML에 실린 표식이 브라우저 클립보드를 지나 붙여넣기까지 살아남는지가 요점이다
  await body.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ControlOrMeta+C");
  await pasteIntoNewParagraph(page);

  await expect(body.getByText(BODY_TEXT, { exact: true })).toHaveCount(2);
  await expect(stickers).toHaveCount(STICKERS.length * 2);
});

test("WHEN 스티커 있는 문단을 복사해 그 문단 글자 가운데에 붙여넣으면 THEN 나뉜 문단의 스티커는 앞 조각에만 있고 붙인 문단의 스티커는 그대로다", async ({
  page,
}, testInfo) => {
  const { body, stickers } = await openStickerDraft(page, testInfo, "sticker-paste-middle");

  // ⌘A 복사는 닫힌 조각이다 — 글자 가운데에 붙이면 자리 문단이 둘로 나뉜다
  await body.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("ControlOrMeta+C");
  await body.getByText(BODY_TEXT).click({ position: TEXT_START });
  for (let i = 0; i < 3; i += 1) await pressMovingSelection(page, "ArrowRight");
  await page.keyboard.press("ControlOrMeta+V");

  // 앞 조각 · 붙인 문단 · 뒤 조각 — 스티커는 앞 조각(원래 것)과 붙인 문단(되살린 것)에만
  // 스티커는 문단(p)의 형제다 — 꾸밈 래퍼 div.post-block 안에 문단과 함께 있다(editor-core dom.ts withDecoration).
  // 그래서 최상위 블록(래퍼 또는 문단) 단위로 센다
  const blocks = body.locator(":scope > *");
  await expect(body.getByText(BODY_TEXT, { exact: true })).toHaveCount(1);
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0).locator("img.post-sticker")).toHaveCount(STICKERS.length);
  await expect(blocks.nth(1)).toHaveText(BODY_TEXT);
  await expect(blocks.nth(1).locator("img.post-sticker")).toHaveCount(STICKERS.length);
  await expect(blocks.nth(2).locator("img.post-sticker")).toHaveCount(0);
  await expect(stickers).toHaveCount(STICKERS.length * 2);
});

test("WHEN 문단을 세 번 클릭해 복사하고 뒤에 문단이 있는 새 빈 문단에 붙여넣은 뒤 글자를 치면 THEN 붙은 문단에 같은 수의 스티커가 있고 친 글자는 그 문단 끝에 붙는다", async ({
  page,
}, testInfo) => {
  const { body, stickers } = await openStickerDraft(page, testInfo, "sticker-copy-triple");

  // 세 번 클릭은 문단 글자 전체를 고른다 — 양끝이 열린 조각이라 붙일 자리 문단에 합쳐지는 모양이다
  await body.getByText(BODY_TEXT).click({ clickCount: 3, position: TEXT_START });
  await page.keyboard.press("ControlOrMeta+C");
  // 빈 문단 둘을 만들고 위의 것에 붙인다 — 붙인 뒤 커서가 뒤 문단으로 넘어가지 않는지 본다
  await pressMovingSelection(page, "ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await pressMovingSelection(page, "ArrowUp");
  await page.keyboard.press("ControlOrMeta+V");
  await page.keyboard.type("끝");

  await expect(body.getByText(`${BODY_TEXT}끝`, { exact: true })).toHaveCount(1);
  await expect(stickers).toHaveCount(STICKERS.length * 2);
});
