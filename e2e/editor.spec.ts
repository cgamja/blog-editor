import { expect, test } from "@playwright/test";
import { collectErrors, logIn } from "./app.test.helpers";

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
  const slug = `e2e-existing-${testInfo.project.name}-${testInfo.retry}`;
  const file = {
    // 서버가 받는 저장 형식 그대로 쓴다 — 스키마 버전이 오르면 이 픽스처도 같이 올려야 하는 계약이다
    schemaVersion: 1,
    meta: {
      title: EXISTING_POST.title,
      description: "실브라우저 층이 기존 글 편집 화면을 여는지 확인하는 글이다.",
      date: "2026-09-25",
      category: "studio",
      draft: true,
      source: "editor",
    },
    doc: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: EXISTING_POST.body }] }],
    },
  };
  // 세션 쿠키가 Secure(__Host-)라 http 루프백에서 page.request는 싣지 않는다(401 실측) — 페이지의 fetch로 만든다
  const status = await page.evaluate(
    async ({ slug, file }) => {
      const response = await fetch(`/api/posts/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-None-Match": "*" },
        body: JSON.stringify(file),
      });
      return response.status;
    },
    { slug, file },
  );
  expect(status).toBe(201);

  await page.goto(`/posts/${slug}/edit`);

  await expect(page.getByRole("textbox", { name: "제목" })).toHaveValue(EXISTING_POST.title);
  await expect(page.getByLabel("본문", { exact: true })).toContainText(EXISTING_POST.body);
});
