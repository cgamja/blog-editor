import { expect, test } from "@playwright/test";
import { createDraft, logIn, submitLogin } from "./app.test.helpers";

const EDIT_PATH = "/posts/any-post/edit";
const LOGIN_WITH_RETURN_PATH = `/login?next=${encodeURIComponent(EDIT_PATH)}`;
// 401이 아닌 실패는 3번 다시 묻는다(query-client.ts) — 재시도 사이 대기(TanStack 기본 1 · 2 · 4초)는 가짜 시계로
// 건너뛴다(https://playwright.dev/docs/clock). 한 번에 가장 긴 대기만큼 앞당기고, 그 사이 요청 응답은 실제 시간에 온다
const LONGEST_RETRY_DELAY_MS = 4_000;
const FAST_FORWARD_CHECK_MS = 200;

test("WHEN 로그인하지 않고 편집 주소를 열면 THEN 로그인 화면으로 간다", async ({ page }) => {
  await page.goto(EDIT_PATH);

  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === LOGIN_WITH_RETURN_PATH);
  await expect(page.getByRole("textbox", { name: "아이디" })).toBeVisible();
});

test("WHEN 로그인된 화면에서 세션이 끊긴 뒤 글 목록으로 가면 THEN 오류 화면이 아니라 로그인 화면이 뜨고, 다시 로그인하면 글 목록으로 돌아온다", async ({
  page,
  context,
}) => {
  await logIn(page);
  // 글 목록이 캐시에 없는 채로 시작한다 — 새로 불러온 페이지라 캐시에는 세션 확인(로그인됨)만 있다
  await page.goto("/settings");
  const postsLink = page.getByRole("link", { name: "글", exact: true });
  await expect(postsLink).toBeVisible();
  // 세션 만료를 흉내 낸다 — 쿠키 이름(배포 · 로컬이 다를 수 있다)에 기대지 않고 모두 지운다
  await context.clearCookies();

  await postsLink.click();

  await expect(page.getByRole("textbox", { name: "아이디" })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  await submitLogin(page);
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { level: 1, name: "글" })).toBeVisible();
});

test("WHEN 세션이 끊긴 뒤 목록에서 글을 열면 THEN 편집 경로를 next로 기억한 로그인 화면이 뜨고, 다시 로그인하면 그 편집 화면으로 돌아온다", async ({
  page,
  context,
}, testInfo) => {
  await logIn(page);
  // 실행 한 번의 저장소를 모든 프로젝트 · 재시도가 같이 쓰므로 주소를 따로 둔다
  const run = `${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  const slug = `e2e-session-lost-${run}`;
  const title = `세션이 끊긴 뒤 여는 글 ${run}`;
  const editPath = `/posts/${slug}/edit`;
  await createDraft(page, slug, title);
  // 목록을 새로 불러와 글이 보이게 한다 — 글 자체는 캐시에 없어 링크를 누르면 편집 화면이 처음 불러온다
  await page.reload();
  const postLink = page.getByRole("link", { name: title, exact: true });
  await expect(postLink).toBeVisible();
  await context.clearCookies();

  await postLink.click();

  await expect(page).toHaveURL(
    (url) => `${url.pathname}${url.search}` === `/login?next=${encodeURIComponent(editPath)}`,
  );
  await submitLogin(page);
  await expect(page).toHaveURL((url) => url.pathname === editPath);
  await expect(page.getByRole("textbox", { name: "제목" })).toHaveValue(title);
});

test("WHEN 로그인한 채 글 목록 요청이 500으로 실패하면 THEN 로그인 화면이 아니라 오류 화면이 뜬다", async ({
  page,
}) => {
  // 시계는 첫 이동 전에 건다 — 앱이 불러올 때 타이머 함수를 잡는다. 건 뒤에도 시간은 저절로 흐른다
  await page.clock.install();
  await logIn(page);
  await page.route("**/api/posts", (route) => route.fulfill({ status: 500 }));
  const errorHeading = page.getByRole("heading", { level: 1, name: "화면을 그리지 못했어요" });

  await page.reload();

  await expect(async () => {
    await page.clock.fastForward(LONGEST_RETRY_DELAY_MS);
    await expect(errorHeading).toBeVisible({ timeout: FAST_FORWARD_CHECK_MS });
  }).toPass({ intervals: [FAST_FORWARD_CHECK_MS] });
  await expect(page).toHaveURL((url) => url.pathname === "/");
});
