import { readLocalConfig } from "./local-config";
import { hashPassword, verifyPassword } from "./password";

describe("api-session — 로컬 진입점 env", () => {
  it("WHEN ADMIN_PASSWORD=1234만 주면 THEN 아이디 admin · 1234로 검증되는 해시 · 비밀 생성 표시", async () => {
    const config = await readLocalConfig({ ADMIN_PASSWORD: "1234" });

    expect(config.username).toBe("admin");
    expect(await verifyPassword("1234", config.passwordHash)).toBe(true);
    expect(config.passwordHash).not.toContain("1234");
    expect(config.generatedSecret).toBe(true);
  });

  it("WHEN ADMIN_PASSWORD와 ADMIN_PASSWORD_HASH를 둘 다 주면 THEN 두 이름을 말하며 멈춘다", async () => {
    const hash = await hashPassword("1234", { N: 1024 });

    await expect(
      readLocalConfig({ ADMIN_PASSWORD: "1234", ADMIN_PASSWORD_HASH: hash }),
    ).rejects.toThrow(/ADMIN_PASSWORD.*ADMIN_PASSWORD_HASH/);
  });

  it("WHEN 비밀번호 env가 하나도 없으면 THEN 두 이름을 말하며 멈춘다", async () => {
    await expect(readLocalConfig({})).rejects.toThrow(/ADMIN_PASSWORD.*ADMIN_PASSWORD_HASH/);
  });

  it('WHEN ADMIN_PASSWORD="" · 올바른 해시를 주면 THEN 빈 평문은 없는 값이고 해시를 쓴다', async () => {
    const hash = await hashPassword("1234", { N: 1024 });

    const config = await readLocalConfig({ ADMIN_PASSWORD: "", ADMIN_PASSWORD_HASH: hash });

    expect(config.passwordHash).toBe(hash);
  });

  it('WHEN ADMIN_PASSWORD_HASH="garbage"를 주면 THEN 형식 오류로 멈춘다', async () => {
    await expect(readLocalConfig({ ADMIN_PASSWORD_HASH: "garbage" })).rejects.toThrow(
      /ADMIN_PASSWORD_HASH 형식/,
    );
  });

  it("WHEN SESSION_SECRET을 주면 THEN 그 값을 쓰고 새로 만들지 않는다", async () => {
    const secret = "given-session-secret-32-bytes-long!!";

    const config = await readLocalConfig({ ADMIN_PASSWORD: "1234", SESSION_SECRET: secret });

    expect(config.sessionSecret).toBe(secret);
    expect(config.generatedSecret).toBe(false);
  });

  it('WHEN ADMIN_USERNAME="  "(공백만)을 주면 THEN 아이디는 admin이다', async () => {
    const config = await readLocalConfig({ ADMIN_PASSWORD: "1234", ADMIN_USERNAME: "  " });

    expect(config.username).toBe("admin");
  });

  it("WHEN PUBLIC_BASE_URL 없이 뜨면 THEN 세션 쿠키는 루프백 http 모드다", async () => {
    const config = await readLocalConfig({ ADMIN_PASSWORD: "1234" });

    expect(config.sessionCookie).toBe("loopback-http");
  });

  it("WHEN PUBLIC_BASE_URL(OAuth 공개 주소)을 주면 THEN 세션 쿠키는 배포와 같은 secure 모드다", async () => {
    const config = await readLocalConfig({
      ADMIN_PASSWORD: "1234",
      PUBLIC_BASE_URL: "https://example.trycloudflare.com",
    });

    expect(config.sessionCookie).toBe("secure");
  });
});
