import { createApp } from "./app";
import type { AppOptions } from "./app";
import { MAX_GUIDE_LENGTH } from "./input-limits";
import { createMemoryPostStore } from "./memory-store";
import { hashConnectionToken } from "./mcp/connection-tokens";
import { createMemoryConnectionTokenStore } from "./mcp/memory-connection-token-store";
import { createMemoryOAuthStore } from "./mcp/oauth/memory-oauth-store";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

const CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const PATH = "/api/settings";

function setup(extra: Partial<AppOptions> = {}) {
  const app = createApp({
    store: createMemoryPostStore(),
    categories: CATEGORIES,
    imageBaseUrl: "https://example.com",
    ...testAuthOptions,
    ...extra,
  });
  return withSession(app);
}

function putJson(body: unknown): RequestInit {
  return {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("workspace-settings-api — 가이드 읽기 · 쓰기", () => {
  it("WHEN MCP가 꺼진 앱에서 설정을 처음 읽으면 THEN 빈 가이드 · 앱의 카테고리 · 꺼진 연결 정보다", async () => {
    const client = setup();

    const res = await client.request(PATH);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      guide: "",
      categories: [...CATEGORIES],
      connector: { enabled: false, url: null },
    });
  });

  it("WHEN 가이드를 저장한 뒤 다시 읽으면 THEN 저장한 가이드이고 카테고리는 그대로다", async () => {
    const client = setup();
    const guide = "말투: 친근한 존댓말.\n독자: 첫 아이를 키우는 부모.";

    const saved = await client.request(PATH, putJson({ guide }));
    const read = await client.request(PATH);

    expect(saved.status).toBe(200);
    expect(await read.json()).toMatchObject({ guide, categories: [...CATEGORIES] });
  });

  it("WHEN JSON 아닌 본문 · 모르는 키 · 너무 긴 가이드로 저장하면 THEN 모두 400이고 가이드가 그대로다", async () => {
    const client = setup();
    await client.request(PATH, putJson({ guide: "앞서 저장한 가이드" }));

    const notJson = await client.request(PATH, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const unknownKey = await client.request(PATH, putJson({ guide: "새 가이드", categories: [] }));
    const tooLong = await client.request(
      PATH,
      putJson({ guide: "가".repeat(MAX_GUIDE_LENGTH + 1) }),
    );

    expect([notJson.status, unknownKey.status, tooLong.status]).toEqual([400, 400, 400]);
    expect(await (await client.request(PATH)).json()).toMatchObject({
      guide: "앞서 저장한 가이드",
    });
  });
});

describe("workspace-settings-api — 연결 주소", () => {
  it("WHEN 발급자 https://editor.example.com으로 OAuth를 켠 앱의 설정을 읽으면 THEN 연결 주소가 <발급자>/mcp다", async () => {
    const token = "t".repeat(64);
    const client = setup({
      mcp: {
        connectionTokens: createMemoryConnectionTokenStore([
          { name: "local", tokenHash: hashConnectionToken(token) },
        ]),
        editorBaseUrl: "https://editor.example.com",
        formatGuide: "형식 가이드",
        oauth: { issuer: "https://editor.example.com", store: createMemoryOAuthStore() },
      },
    });

    const res = await client.request(PATH);

    expect(await res.json()).toMatchObject({
      connector: { enabled: true, url: "https://editor.example.com/mcp" },
    });
  });
});
