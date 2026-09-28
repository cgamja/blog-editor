import { randomBytes, randomUUID } from "node:crypto";
import { fixtures } from "@blog-editor/content-schema";
import { createClient } from "@supabase/supabase-js";
import { describeAiUndoStoreContract } from "../ai-undo-store.contract";
import { pngBytes } from "../images.test.helpers";
import { describeLoginLockoutContract } from "../login-lockout.contract";
import type { AuthorizationCode, OAuthClient } from "../mcp/oauth/store";
import { describePostStoreContract } from "../post-store.contract";
import { createSupabaseAiUndoStore } from "./ai-undo-store";
import { createSupabaseImageStore } from "./image-store";
import { createSupabaseLoginLockout } from "./login-lockout";
import { createSupabaseOAuthStore } from "./oauth-store";
import { createSupabasePostStore } from "./post-store";
import { createSupabaseSettingsStore } from "./settings-store";
import {
  createTestServerClient,
  supabaseSuiteName,
  supabaseTestEnv,
  useSupabaseTestData,
} from "./test-env.test.helpers";

// 네트워크로 시험 프로젝트를 부른다 — 계약 스위트의 연속 요청이 기본 5초를 넘을 수 있다
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const nowSeconds = () => Math.floor(Date.now() / 1000);
const newImageName = () => `${randomBytes(16).toString("hex")}.png`;

describe.skipIf(supabaseTestEnv === null)(supabaseSuiteName("Supabase 저장소"), () => {
  const data = useSupabaseTestData();

  describePostStoreContract("SupabasePostStore", async () =>
    createSupabasePostStore({
      client: createTestServerClient(),
      workspaceId: data.newWorkspaceId(),
    }),
  );

  describeAiUndoStoreContract("SupabaseAiUndoStore", async () =>
    createSupabaseAiUndoStore({
      client: createTestServerClient(),
      workspaceId: data.newWorkspaceId(),
    }),
  );

  describeLoginLockoutContract(
    "SupabaseLoginLockout",
    async () => createSupabaseLoginLockout({ client: createTestServerClient() }),
    data.newLockoutKey,
  );

  describe("supabase-store — 워크스페이스 분리", () => {
    it("WHEN 워크스페이스 a · b에 같은 slug로 다른 글을 쓰면 THEN 각자 자기 글만 get · list하고 a의 delete가 b를 지우지 않는다", async () => {
      const client = createTestServerClient();
      const a = createSupabasePostStore({ client, workspaceId: data.newWorkspaceId() });
      const b = createSupabasePostStore({ client, workspaceId: data.newWorkspaceId() });
      const inA = await a.put("same-slug", fixtures.minimal, null);
      const inB = await b.put("same-slug", fixtures.allBlocks, null);

      expect(await a.get("same-slug")).toEqual({ file: fixtures.minimal, revision: inA.revision });
      expect(await b.get("same-slug")).toEqual({
        file: fixtures.allBlocks,
        revision: inB.revision,
      });
      expect(await a.list()).toEqual([{ slug: "same-slug", meta: fixtures.minimal.meta }]);
      expect(await b.list()).toEqual([{ slug: "same-slug", meta: fixtures.allBlocks.meta }]);

      await a.delete("same-slug", inA.revision);

      expect(await a.get("same-slug")).toBeNull();
      expect(await b.get("same-slug")).toEqual({
        file: fixtures.allBlocks,
        revision: inB.revision,
      });
    });
  });

  describe("supabase-store — 설정 · 사진 · OAuth 상태", () => {
    it("WHEN 가이드 · 이미지 · OAuth 클라이언트를 쓰고 새 저장소 인스턴스로 읽으면 THEN 같은 가이드 · 같은 바이트 · 같은 클라이언트다", async () => {
      const workspaceId = data.newWorkspaceId();
      const imageName = data.trackImage(newImageName());
      const bytes = pngBytes(4, 3);
      const oauthClient: OAuthClient = {
        clientId: data.trackOAuthClient(`test-client-${randomUUID()}`),
        clientName: "시험 클라이언트",
        redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
        registeredAt: nowSeconds(),
      };
      const writer = createTestServerClient();
      await createSupabaseSettingsStore({ client: writer, workspaceId }).put({
        guide: "새 인스턴스로 읽는 가이드",
      });
      await createSupabaseImageStore({ client: writer }).put(imageName, bytes, "image/png");
      const saved = await createSupabaseOAuthStore({ client: writer }).saveClient(
        oauthClient,
        nowSeconds(),
      );

      const reader = createTestServerClient();
      const images = createSupabaseImageStore({ client: reader });

      expect(saved).toBe(true);
      expect(await createSupabaseSettingsStore({ client: reader, workspaceId }).get()).toEqual({
        guide: "새 인스턴스로 읽는 가이드",
      });
      expect(await images.has(imageName)).toBe(true);
      expect(await images.get(imageName)).toEqual(bytes);
      expect(
        await createSupabaseOAuthStore({ client: reader }).findClient(oauthClient.clientId),
      ).toEqual(oauthClient);
    });

    it("WHEN 같은 코드 해시로 takeCode를 동시에 두 번 부르면 THEN 하나만 코드를 받고 다른 하나는 null이다", async () => {
      const store = createSupabaseOAuthStore({ client: createTestServerClient() });
      const codeHash = data.trackOAuthCode(randomBytes(32).toString("hex"));
      const code: AuthorizationCode = {
        clientId: `test-client-${randomUUID()}`,
        accountId: "owner",
        resource: "https://editor.example.test/mcp",
        scope: "drafts",
        sourceName: "claude-ai",
        redirectUri: "https://claude.ai/api/mcp/auth_callback",
        codeChallenge: "challenge",
        expiresAt: nowSeconds() + 600,
      };
      await store.saveCode(codeHash, code);

      const taken = await Promise.all([
        store.takeCode(codeHash, nowSeconds()),
        store.takeCode(codeHash, nowSeconds()),
      ]);

      expect(taken.filter((result) => result === null)).toHaveLength(1);
      expect(taken.find((result) => result !== null)).toEqual(code);
    });
  });

  describe("supabase-store — 공개 키 거부 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
    it("WHEN 초안 한 편 · 사진 한 장이 있는 시험 프로젝트에 공개 키로 글 표를 조회하고 사진을 받으면 THEN 행이 0개이고 사진은 받을 수 없다", async () => {
      const env = supabaseTestEnv;
      if (env === null) throw new Error("시험 키 없음");
      const workspaceId = data.newWorkspaceId();
      const imageName = data.trackImage(newImageName());
      const server = createTestServerClient();
      await createSupabasePostStore({ client: server, workspaceId }).put(
        "secret-draft",
        fixtures.minimal,
        null,
      );
      await createSupabaseImageStore({ client: server }).put(
        imageName,
        pngBytes(2, 2),
        "image/png",
      );
      // 거부가 "없어서"가 아니게 — 서버 키로는 같은 행 · 객체가 보인다
      const serverRows = await server.from("posts").select("slug").eq("workspace_id", workspaceId);
      const serverImage = await server.storage.from("images").download(imageName);
      const anon = createClient(env.url, env.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const anonRows = await anon.from("posts").select("*").eq("workspace_id", workspaceId);
      const anonImage = await anon.storage.from("images").download(imageName);
      const publicUrl = anon.storage.from("images").getPublicUrl(imageName).data.publicUrl;
      const publicResponse = await fetch(publicUrl);

      expect(serverRows.data).toEqual([{ slug: "secret-draft" }]);
      expect(serverImage.error).toBeNull();
      expect(anonRows.data ?? []).toEqual([]);
      expect(anonImage.data).toBeNull();
      expect(publicResponse.ok).toBe(false);
    });
  });
});
