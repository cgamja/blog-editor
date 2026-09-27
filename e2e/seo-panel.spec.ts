import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createDraftWithBlocks, logIn } from "./app.test.helpers";

// 편집 화면 머리줄의 검색 노출 칩 · 팝오버 · 본문 여백 점(#151 디자인 C) — 발행 확인과 같은 checkSeo · scoreSeo를
// 입력마다(디바운스) 다시 부른다. 문구는 content-schema seo.messages.ts · web messages.ts의 것 그대로다.
const CHIP_NAME = /^검색 노출 \d+/;
const DIALOG_SCORE_TEXT = /^검색 노출 점수 \d+점$/;
const DESCRIPTION_LENGTH_MESSAGE = "설명이 권장 길이(40~120자)를 벗어나요.";
const KEYWORD_NOT_IN_FIRST_PARAGRAPH = "핵심 검색어가 첫 문단에 없어요.";
// 여백 점의 이름은 "<등급>: <문구>" — keyword-in-first-paragraph는 should(권장)
const FIRST_PARAGRAPH_DOT = `권장: ${KEYWORD_NOT_IN_FIRST_PARAGRAPH}`;
// createDraftWithBlocks의 설명(29자)은 권장 길이 40자보다 짧다 — 이 칸을 권장 범위로 채운다
const LONG_ENOUGH_DESCRIPTION =
  "아이와 봄에 걷기 좋은 서울 공원 다섯 곳을 골라 가는 길, 쉴 곳, 붐비지 않는 시간을 정리했어요.";
const FIRST_HEADING = "봄 산책은 어디로 갈까?";
const FIRST_PARAGRAPH = "아침 공기가 한가해서 유모차를 밀기 좋아요.";
const KEYWORD_OUTSIDE_FIRST_PARAGRAPH = "가을 소풍";
const KEYWORD_IN_FIRST_PARAGRAPH = "유모차";
const IMAGE_ALT_MESSAGE = "이미지 설명(alt)이 비어 있어요.";
// 목록 실패는 처음 1번 + 재시도 3번(query-client.ts), 재시도 대기(1 · 2 · 4초)는 가짜 시계로 건너뛴다 — seo.spec.ts와 같다
const POSTS_LIST_ATTEMPTS = 4;
const LONGEST_RETRY_DELAY_MS = 4_000;
const FAST_FORWARD_CHECK_MS = 200;

const slugOf = (name: string, testInfo: TestInfo) =>
  `e2e-seo-panel-${name}-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;

/** 소제목(블록 1) · 문단(블록 2) — 첫 문단이 블록 2라 "블록 1"로 잘못 가면 드러난다 */
async function openDraft(page: Page, slug: string): Promise<void> {
  await createDraftWithBlocks(page, slug, "아이랑 봄 산책하기 좋은 서울 공원", [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: FIRST_HEADING }] },
    { type: "paragraph", content: [{ type: "text", text: FIRST_PARAGRAPH }] },
  ]);
  await page.goto(`/posts/${slug}/edit`);
}

const escaped = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\~]/g, "\\$&"));

function seoChip(page: Page): Locator {
  return page.getByRole("button", { name: CHIP_NAME });
}

/** 칩 이름 "검색 노출 N…"의 N — 뒤에 붙는 꼭 고치기 개수 배지와 헷갈리지 않게 첫 숫자만 읽는다 */
async function chipScore(page: Page): Promise<number> {
  const name = (await seoChip(page).textContent()) ?? "";
  return Number(name.match(/검색 노출\s*(\d+)/)?.[1]);
}

/** 칩을 눌러 여는 점검 목록 — 팝오버가 dialog인지 region인지는 구현이 고른다 */
async function openSeoPopover(page: Page): Promise<Locator> {
  await seoChip(page).click();
  const popover = page
    .getByRole("dialog", { name: "검색 노출 점검" })
    .or(page.getByRole("region", { name: "검색 노출 점검" }));
  await expect(popover).toBeVisible();
  return popover;
}

test("WHEN 설명이 권장 길이보다 짧은 초안을 열면 THEN 머리줄 검색 노출 칩의 점수가 발행 확인의 점수와 같다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  await openDraft(page, slugOf("same-score", testInfo));

  const headerScore = await chipScore(page);
  await page.getByRole("button", { name: "발행", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 글을 발행할까요?" });
  const dialogText = await dialog.getByText(DIALOG_SCORE_TEXT).textContent();

  expect(Number(dialogText?.match(/\d+/)?.[0])).toBe(headerScore);
});

test("WHEN 설명 칸에 권장 길이의 설명을 입력하면 THEN 점수가 오르고 점검 목록에서 설명 항목이 사라진다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  await openDraft(page, slugOf("description", testInfo));
  await expect(seoChip(page)).toBeVisible();
  const before = await chipScore(page);

  await page.getByRole("textbox", { name: "설명" }).fill(LONG_ENOUGH_DESCRIPTION);

  await expect.poll(() => chipScore(page)).toBeGreaterThan(before);
  const popover = await openSeoPopover(page);
  await expect(
    popover.getByRole("button", { name: escaped(DESCRIPTION_LENGTH_MESSAGE) }),
  ).toHaveCount(0);
});

test("WHEN 핵심 검색어를 첫 문단에 없는 말로 바꾸면 THEN 첫 문단 옆 여백에 점이 생기고 있는 말로 바꾸면 사라진다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  await openDraft(page, slugOf("keyword", testInfo));
  const keyword = page.getByRole("textbox", { name: "핵심 검색어" });
  const dot = page.getByRole("button", { name: FIRST_PARAGRAPH_DOT, exact: true });
  const paragraph = page.getByLabel("본문", { exact: true }).getByText(FIRST_PARAGRAPH);

  await keyword.fill(KEYWORD_OUTSIDE_FIRST_PARAGRAPH);
  await expect(dot).toBeVisible();
  // 점은 첫 문단(블록 2) 옆이다 — 점의 세로 가운데가 그 문단의 줄 범위 안에 있다
  const dotBox = await dot.boundingBox();
  const paragraphBox = await paragraph.boundingBox();
  const dotCenterY = (dotBox?.y ?? 0) + (dotBox?.height ?? 0) / 2;
  expect(dotCenterY).toBeGreaterThanOrEqual(paragraphBox?.y ?? Infinity);
  expect(dotCenterY).toBeLessThanOrEqual((paragraphBox?.y ?? 0) + (paragraphBox?.height ?? 0));

  await keyword.fill(KEYWORD_IN_FIRST_PARAGRAPH);
  await expect(dot).toHaveCount(0);
});

test("WHEN 점검 목록에서 첫 문단(블록 2) 항목을 누르면 THEN 본문 편집기의 선택이 그 문단 안으로 간다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  await openDraft(page, slugOf("jump", testInfo));
  await page.getByRole("textbox", { name: "핵심 검색어" }).fill(KEYWORD_OUTSIDE_FIRST_PARAGRAPH);
  const popover = await openSeoPopover(page);

  await popover.getByRole("button", { name: escaped(KEYWORD_NOT_IN_FIRST_PARAGRAPH) }).click();

  // 본문 편집 영역은 aria-label "본문"인 contenteditable(use-blog-editor.ts) — 포커스와 선택의 최상위 블록을 본다.
  // e2e tsconfig에는 DOM lib이 없어 브라우저 쪽 코드는 문자열로 넘긴다(hard-break.spec.ts와 같다)
  await expect
    .poll(() =>
      page.evaluate(`(() => {
        const editor = document.querySelector('[aria-label="본문"][contenteditable="true"]');
        let block = document.getSelection()?.anchorNode ?? null;
        while (block !== null && block.parentNode !== editor) block = block.parentNode;
        return {
          focused: editor !== null && editor.contains(document.activeElement),
          blockText: block?.textContent ?? null,
        };
      })()`),
    )
    .toEqual({ focused: true, blockText: FIRST_PARAGRAPH });
});

test("WHEN 다른 글 목록 요청이 끝내 실패하면 THEN 머리줄 칩에 점수 숫자 대신 점검 못 함이 보인다", async ({
  page,
}, testInfo) => {
  // 시계는 첫 이동 전에 건다 — 앱이 불러올 때 타이머 함수를 잡는다
  await page.clock.install();
  await logIn(page);
  const slug = slugOf("list-failed", testInfo);
  await createDraftWithBlocks(page, slug, "아이랑 봄 산책하기 좋은 서울 공원", [
    { type: "paragraph", content: [{ type: "text", text: FIRST_PARAGRAPH }] },
  ]);
  let listAttempts = 0;
  await page.route("**/api/posts", (route) => {
    listAttempts += 1;
    return route.fulfill({ status: 500 });
  });

  await page.goto(`/posts/${slug}/edit`);
  await expect(async () => {
    await page.clock.fastForward(LONGEST_RETRY_DELAY_MS);
    expect(listAttempts).toBe(POSTS_LIST_ATTEMPTS);
  }).toPass({ intervals: [FAST_FORWARD_CHECK_MS] });

  await expect(page.getByRole("button", { name: "검색 노출 점검 못 함" })).toBeVisible();
  await expect(seoChip(page)).toHaveCount(0);
});

test("WHEN 팝오버가 열린 채 Esc를 누르면 THEN 닫히고 포커스가 칩으로 돌아오며, 다시 열어 바깥을 누르면 닫힌다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  await openDraft(page, slugOf("close", testInfo));
  const popover = await openSeoPopover(page);

  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(seoChip(page)).toBeFocused();

  const reopened = await openSeoPopover(page);
  await page.getByLabel("본문", { exact: true }).getByText(FIRST_PARAGRAPH).click();
  await expect(reopened).toHaveCount(0);
});

test("WHEN 점검 목록에서 대체 텍스트가 빈 그림(블록 2) 항목을 누르면 THEN 본문 편집기가 그 그림을 노드 선택한다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = slugOf("image-jump", testInfo);
  await createDraftWithBlocks(page, slug, "아이랑 봄 산책하기 좋은 서울 공원", [
    { type: "paragraph", content: [{ type: "text", text: FIRST_PARAGRAPH }] },
    { type: "image", attrs: { src: "/images/cherry-walk.webp", alt: "" } },
    { type: "paragraph", content: [{ type: "text", text: "점심은 공원 앞 국숫집에서 먹었어요." }] },
  ]);
  await page.goto(`/posts/${slug}/edit`);
  const popover = await openSeoPopover(page);

  await popover.getByRole("button", { name: escaped(IMAGE_ALT_MESSAGE) }).click();

  // ProseMirror는 노드 선택된 블록의 DOM에 ProseMirror-selectednode 클래스를 붙인다
  // https://prosemirror.net/docs/ref/#view.NodeView.selectNode — 그 요소가 그림(img 또는 img를 품은 틀)인지 본다
  await expect
    .poll(() =>
      page.evaluate(`(() => {
        const editor = document.querySelector('[aria-label="본문"][contenteditable="true"]');
        const selected = editor?.querySelector('.ProseMirror-selectednode') ?? null;
        return {
          focused: editor !== null && editor.contains(document.activeElement),
          selectedIsImage:
            selected !== null && (selected.tagName === 'IMG' || selected.querySelector('img') !== null),
        };
      })()`),
    )
    .toEqual({ focused: true, selectedIsImage: true });
});
