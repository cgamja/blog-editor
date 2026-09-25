import { expect, test } from "@playwright/test";
import { logIn } from "./app.test.helpers";

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
