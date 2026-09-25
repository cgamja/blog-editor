import { expect, test } from "@playwright/test";
import { collectErrors, createDraft, logIn } from "./app.test.helpers";

const EXISTING_POST = {
  title: "편집 화면 확인용 글",
  body: "저장해 둔 본문이 편집 화면에 그대로 보인다.",
} as const;

test("WHEN 로그인한 채 새 글 주소를 열면 THEN 편집 화면이 오류 없이 뜨고 본문에 글을 쓸 수 있다", async ({
  page,
}) => {
  await logIn(page);
  const errors = collectErrors(page);

  // 목록의 링크(클라이언트 전환)가 아니라 주소로 연다 — #108은 새로 불러온 페이지가 세션 확인 뒤 편집 화면을
  // 그릴 때 렌더가 양보되며 에디터가 파기됐다. 링크 클릭으로는 수정 전 코드에서도 재현되지 않았다(실측)
  await page.goto("/posts/new");
  // 본문 편집 영역은 textbox 역할 없이 aria-label만 있다(use-blog-editor.ts) — 라벨로 찾는다
  const body = page.getByLabel("본문", { exact: true });
  await body.click();
  await page.keyboard.type("첫 문장");

  await expect(body).toContainText("첫 문장");
  expect(errors).toEqual([]);
});

test("WHEN 저장된 글의 편집 주소를 열면 THEN 제목과 본문이 채워진 편집 화면이 뜬다", async ({
  page,
}, testInfo) => {
  await logIn(page);
  // 실행 한 번의 저장소를 모든 프로젝트 · 재시도가 같이 쓰므로 주소를 따로 둔다
  const slug = `e2e-existing-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  await createDraft(page, slug, EXISTING_POST.title, EXISTING_POST.body);

  await page.goto(`/posts/${slug}/edit`);

  await expect(page.getByRole("textbox", { name: "제목" })).toHaveValue(EXISTING_POST.title);
  await expect(page.getByLabel("본문", { exact: true })).toContainText(EXISTING_POST.body);
});
