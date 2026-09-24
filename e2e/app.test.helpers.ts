import { expect, type Page } from "@playwright/test";
import { E2E_ACCOUNT } from "./account.test.helpers";

/** 로그인 화면에서 테스트 계정으로 들어가 글 목록이 뜰 때까지 기다린다 */
export async function logIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "아이디" }).fill(E2E_ACCOUNT.username);
  // type=password 입력은 textbox 역할이 없어 라벨로 찾는다
  await page.getByLabel("비밀번호").fill(E2E_ACCOUNT.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("link", { name: "새 글" }).first()).toBeVisible();
}

/**
 * 콘솔 오류와 잡히지 않은 예외를 모은다. #108은 화면 틀은 떴는데 에디터가 부서진 채였다 — 보이는 것만 확인하면
 * 놓친다. 로그인 전의 세션 확인(401)도 브라우저가 콘솔 오류로 찍으므로 로그인 뒤에 건다.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
