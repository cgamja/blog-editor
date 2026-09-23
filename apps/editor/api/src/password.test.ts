import { hashPassword, verifyPassword } from "./password";

describe("api-session — 비밀번호 해시", () => {
  it("WHEN 해시한 뒤 같은 비밀번호 · 한 글자 다른 비밀번호로 검증하면 THEN 맞음 · 틀림이고 해시에 원문이 없다", async () => {
    const password = "correct-horse-battery-staple";

    const hash = await hashPassword(password, { N: 1024 });

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("correct-horse-battery-staplE", hash)).toBe(false);
    expect(hash).not.toContain(password);
  });

  it("WHEN 파라미터가 잘못된 해시(N이 2의 거듭제곱 아님 · 메모리 한도 초과)로 검증하면 THEN 던지지 않고 false다", async () => {
    const valid = await hashPassword("correct-horse-battery-staple", { N: 1024 });
    const [, , r, p, salt, key] = valid.split("$");
    const notPowerOfTwo = ["scrypt", 1000, r, p, salt, key].join("$");
    const overMemory = ["scrypt", 2 ** 20, 64, p, salt, key].join("$");
    // OpenSSL 제약 N < 2^(16·r) — r=1이면 메모리 한도 안이라도 N=65536은 거부된다
    const overCostLimit = ["scrypt", 2 ** 16, 1, p, salt, key].join("$");

    expect(await verifyPassword("correct-horse-battery-staple", notPowerOfTwo)).toBe(false);
    expect(await verifyPassword("correct-horse-battery-staple", overMemory)).toBe(false);
    expect(await verifyPassword("correct-horse-battery-staple", overCostLimit)).toBe(false);
  });
});
