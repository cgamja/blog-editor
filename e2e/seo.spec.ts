import { expect, test } from "@playwright/test";
import { createDraft, logIn } from "./app.test.helpers";

// 401이 아닌 실패는 3번 다시 묻는다(query-client.ts) — 처음 1번 + 재시도 3번. 재시도 사이 대기(TanStack 기본
// 1 · 2 · 4초)는 가짜 시계로 건너뛴다(https://playwright.dev/docs/clock) — session.spec.ts와 같은 방식
const POSTS_LIST_ATTEMPTS = 4;
const LONGEST_RETRY_DELAY_MS = 4_000;
const FAST_FORWARD_CHECK_MS = 200;

test("WHEN alt 없는 이미지가 든 글에 핵심 검색어를 적고 발행을 누르면 THEN 점검 목록에 이미지 설명과 100보다 작은 점수가 보이고 발행된다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = `e2e-seo-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  const file = {
    schemaVersion: 1,
    meta: {
      title: "아이랑 봄 산책하기 좋은 서울 공원",
      description: "실브라우저 층이 발행 확인의 검색 노출 점검을 보려고 만든 초안이다.",
      date: "2026-09-25",
      category: "studio",
      draft: true,
      source: "editor",
    },
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "봄 산책은 아침이 한가해요." }] },
        { type: "image", attrs: { src: "/images/cherry-walk.webp", alt: "" } },
      ],
    },
  };
  const created = await page.evaluate(
    async ({ slug, file }) =>
      (
        await fetch(`/api/posts/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "If-None-Match": "*" },
          body: JSON.stringify(file),
        })
      ).status,
    { slug, file },
  );
  expect(created).toBe(201);

  await page.goto(`/posts/${slug}/edit`);
  await page.getByRole("textbox", { name: "핵심 검색어" }).fill("봄 산책");
  await page.getByRole("button", { name: "발행", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 글을 발행할까요?" });
  const checklist = dialog.getByRole("list", { name: "검색 노출 점검" });

  await expect(checklist).toContainText("이미지 설명");
  const score = await dialog.getByText(/^검색 노출 점수 \d+점$/).textContent();
  expect(Number(score?.match(/\d+/)?.[0])).toBeLessThan(100);
  await dialog.getByRole("button", { name: "발행", exact: true }).click();

  await expect
    .poll(async () =>
      page.evaluate(async (slug) => {
        const saved = (await (await fetch(`/api/posts/${slug}`)).json()) as {
          meta: { draft: boolean; keyword?: string };
        };
        return saved.meta;
      }, slug),
    )
    .toMatchObject({ draft: false, keyword: "봄 산책" });
});

test("WHEN 글 목록 요청이 실패한 채 발행 확인을 열면 THEN 검색 노출 점수 대신 점검 불가 안내와 다시 시도가 보인다", async ({
  page,
}, testInfo) => {
  // 시계는 첫 이동 전에 건다 — 앱이 불러올 때 타이머 함수를 잡는다
  await page.clock.install();
  await logIn(page);
  const slug = `e2e-seo-list-failed-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraft(page, slug, "아이랑 봄 산책하기 좋은 서울 공원");
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
  await page.getByRole("button", { name: "발행", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 글을 발행할까요?" });

  await expect(dialog.getByText(/^검색 노출 점수 \d+점$/)).toHaveCount(0);
  await expect(dialog.getByRole("list", { name: "검색 노출 점검" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "다시 시도" })).toBeVisible();
});

test("WHEN 목록 실패로 점검 불가 안내가 보인 뒤 목록이 여전히 실패하는 채로 다시 시도를 누르면 THEN 재시도 중에도 검색 노출 점수가 보이지 않는다", async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await logIn(page);
  const slug = `e2e-seo-list-retry-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraft(page, slug, "아이랑 봄 산책하기 좋은 서울 공원");
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
  await page.getByRole("button", { name: "발행", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 글을 발행할까요?" });
  await dialog.getByRole("button", { name: "다시 시도" }).click();

  // 재시도의 첫 요청이 나간 뒤 화면 갱신 타이머만 조금 진행한다 — 다음 재시도 대기(1초) 전이라 아직 재시도 중이다
  await expect.poll(() => listAttempts).toBeGreaterThan(POSTS_LIST_ATTEMPTS);
  await page.clock.runFor(FAST_FORWARD_CHECK_MS);
  await expect(dialog.getByText(/^검색 노출 점수 \d+점$/)).toHaveCount(0);
  // 재시도 중에도 "확인 중"으로 바뀌지 않고 점검 불가 안내 · 다시 시도가 그대로다(스펙: 이 안내를 유지)
  await expect(dialog.getByText("다른 글 목록을 읽지 못해", { exact: false })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "다시 시도" })).toBeVisible();
});

test("WHEN 글 목록 응답이 아직 오지 않은 채 발행 확인을 열면 THEN 검색 노출 점수가 보이지 않는다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  const slug = `e2e-seo-list-loading-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraft(page, slug, "아이랑 봄 산책하기 좋은 서울 공원");
  let listRequested = false;
  // 목록 응답을 붙잡아 둔다 — 테스트가 끝날 때까지 풀지 않는다
  await page.route("**/api/posts", () => {
    listRequested = true;
  });

  await page.goto(`/posts/${slug}/edit`);
  await expect.poll(() => listRequested).toBe(true);
  await page.getByRole("button", { name: "발행", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 글을 발행할까요?" });

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/^검색 노출 점수 \d+점$/)).toHaveCount(0);
});
