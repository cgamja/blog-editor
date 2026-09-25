import { expect, type Page } from "@playwright/test";
import { E2E_ACCOUNT } from "./account.test.helpers";

/** 로그인 화면에서 테스트 계정으로 들어가 글 목록이 뜰 때까지 기다린다 */
export async function logIn(page: Page): Promise<void> {
  await page.goto("/login");
  await submitLogin(page);
  await expect(page.getByRole("link", { name: "새 글" }).first()).toBeVisible();
}

/** 이미 떠 있는 로그인 화면에 테스트 계정을 넣고 보낸다 — 가드가 보낸 로그인 화면(돌아갈 경로 유지)에서 쓴다 */
export async function submitLogin(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "아이디" }).fill(E2E_ACCOUNT.username);
  // type=password 입력은 textbox 역할이 없어 라벨로 찾는다
  await page.getByLabel("비밀번호").fill(E2E_ACCOUNT.password);
  await page.getByRole("button", { name: "로그인" }).click();
}

/**
 * 초안 한 편을 저장소에 바로 만든다. 실브라우저 층의 저장 형식 픽스처는 여기 하나다 — 서버가 받는 형식 그대로라
 * 스키마 버전이 오르면 이것을 같이 올리는 계약이다. 본문을 주지 않으면 제목을 본문으로 쓴다.
 * `blockAttrs`는 본문 문단의 꾸밈 속성(스티커 등) — 저장 형식 그대로라 서버의 zod가 한 번 더 거른다.
 * 페이지의 fetch로 보낸다 — 화면과 같은 출처 · 세션 쿠키로 만든다.
 */
export async function createDraft(
  page: Page,
  slug: string,
  title: string,
  body: string = title,
  blockAttrs?: Record<string, unknown>,
): Promise<void> {
  const file = {
    schemaVersion: 1,
    meta: {
      title,
      description: "실브라우저 층이 화면 흐름을 확인하려고 만든 초안이다.",
      date: "2026-09-25",
      category: "studio",
      draft: true,
      source: "editor",
    },
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          ...(blockAttrs === undefined ? {} : { attrs: blockAttrs }),
          content: [{ type: "text", text: body }],
        },
      ],
    },
  };
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
