import { expect, test } from "@playwright/test";

const EDIT_PATH = "/posts/any-post/edit";
const LOGIN_WITH_RETURN_PATH = `/login?next=${encodeURIComponent(EDIT_PATH)}`;

test("WHEN 로그인하지 않고 편집 주소를 열면 THEN 로그인 화면으로 간다", async ({ page }) => {
  await page.goto(EDIT_PATH);

  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === LOGIN_WITH_RETURN_PATH);
  await expect(page.getByRole("textbox", { name: "아이디" })).toBeVisible();
});
