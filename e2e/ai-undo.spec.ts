import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { E2E_MCP_TOKEN } from "./account.test.helpers";
import { createDraft, logIn } from "./app.test.helpers";

// `/mcp`는 web dev 서버가 프록시하지 않는다 — api 포트로 바로 부른다(playwright.config.ts가 env에 적는다)
const MCP_URL = `http://127.0.0.1:${process.env.E2E_API_PORT}/mcp`;
const MCP_PROTOCOL_VERSION = "2025-06-18";

/** 연결용 토큰으로 MCP 도구 하나를 부르고 결과 텍스트를 JSON으로 읽는다(SSE `data:` 한 줄 또는 JSON 본문) */
async function callMcpTool(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await request.post(MCP_URL, {
    headers: {
      authorization: `Bearer ${E2E_MCP_TOKEN}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.status()).toBe(200);
  const text = await response.text();
  const payload = text.startsWith("{")
    ? text
    : (text.split("\n").find((line) => line.startsWith("data: ")) ?? "").slice("data: ".length);
  const { result } = JSON.parse(payload) as {
    result: { isError?: boolean; content: Array<{ text: string }> };
  };
  expect(result.isError ?? false).toBe(false);
  return JSON.parse(result.content.map((part) => part.text).join("\n")) as Record<string, unknown>;
}

test("WHEN MCP로 고친 초안의 편집 화면에서 「AI 수정 되돌리기」를 누르고 확인하면 THEN 본문이 고치기 전 글이고 버튼이 사라진다", async ({
  page,
  request,
}, testInfo) => {
  await logIn(page);
  const slug = `e2e-ai-undo-${testInfo.project.name}-${testInfo.repeatEachIndex}-${testInfo.retry}`;
  const original = "사람이 처음 쓴 문단이다.";
  const byAi = "AI가 통째로 바꾼 문단이다.";
  await createDraft(page, slug, "AI가 고칠 초안", original);
  const { revision } = await callMcpTool(request, "get_post", { slug });
  await callMcpTool(request, "update_draft", { slug, revision, markdown: byAi });

  await page.goto(`/posts/${slug}/edit`);
  const body = page.getByLabel("본문", { exact: true });
  await expect(body).toContainText(byAi);
  const undo = page.getByRole("button", { name: "AI 수정 되돌리기" });
  await undo.click();
  await page.getByRole("dialog").getByRole("button", { name: "되돌리기", exact: true }).click();

  await expect(body).toContainText(original);
  await expect(body).not.toContainText(byAi);
  await expect(undo).toBeHidden();
});
