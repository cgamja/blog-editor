import { hashConnectionToken } from "./mcp/connection-tokens";
import { readEdgeConfig } from "./edge-config";
import { PASSWORD_HASH, VALID_ENV } from "./edge-env.test.helpers";

describe("edge-deploy — 배포 설정 읽기 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  // 아래 거부 테스트들의 기준 — 모든 것을 거부하는 구현이면 거부 테스트가 의미 없이 초록이 된다
  it("WHEN 필수 값이 다 있는 env를 읽으면 THEN 해시 · Supabase 값을 그대로 담고 연결용 토큰은 없다", () => {
    const config = readEdgeConfig(VALID_ENV);

    expect(config).toMatchObject({
      passwordHash: PASSWORD_HASH,
      sessionSecret: VALID_ENV.SESSION_SECRET,
      publicBaseUrl: "https://editor.example.test",
      supabaseUrl: "https://project.supabase.co",
      supabaseSecretKey: "sb_secret_test_key",
      connection: null,
    });
  });

  it("WHEN 배포 설정에 평문 ADMIN_PASSWORD를 주면 THEN ADMIN_PASSWORD_HASH만 받는다는 오류다", () => {
    expect(() => readEdgeConfig({ ...VALID_ENV, ADMIN_PASSWORD: "plain-password" })).toThrow(
      /ADMIN_PASSWORD_HASH/,
    );
  });

  it("WHEN SESSION_SECRET 없이 배포 설정을 읽으면 THEN SESSION_SECRET이 빠졌다는 오류다", () => {
    expect(() => readEdgeConfig({ ...VALID_ENV, SESSION_SECRET: undefined })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("WHEN RELAY_SECRET 없이 배포 설정을 읽으면 THEN RELAY_SECRET이 빠졌다는 오류다", () => {
    expect(() => readEdgeConfig({ ...VALID_ENV, RELAY_SECRET: undefined })).toThrow(/RELAY_SECRET/);
  });

  it("WHEN 배포 설정에 평문 MCP_CONNECTION_TOKEN을 주면 THEN MCP_CONNECTION_TOKEN_HASH만 받는다는 오류다", () => {
    expect(() =>
      readEdgeConfig({
        ...VALID_ENV,
        MCP_CONNECTION_TOKEN: "plain-connection-token",
        MCP_CONNECTION_TOKEN_HASH: hashConnectionToken("plain-connection-token"),
      }),
    ).toThrow(/MCP_CONNECTION_TOKEN_HASH/);
  });
});
