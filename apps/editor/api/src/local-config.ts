/**
 * 로컬 진입점(serve.ts)의 env 해석. 서버 기동과 떼어 둔 것은 규칙을 테스트하기 위해서다.
 * 로컬 서버는 루프백 전용이라 짧은 비밀번호(예: 1234)를 받는다 — 배포(M4) 진입점은 이 경로를 쓰지 않는다.
 * 그쪽은 D8 전제(긴 무작위 비밀번호)를 지키거나 잠금 카운터를 같이 넣는다.
 */
import { randomBytes } from "node:crypto";
import { hashPassword, isValidPasswordHash } from "./password";

export interface LocalConfig {
  username: string;
  passwordHash: string;
  sessionSecret: string;
  /** SESSION_SECRET이 없어 새로 만들었다 — 재시작하면 세션이 끊긴다 */
  generatedSecret: boolean;
}

const DEFAULT_USERNAME = "admin";
const GENERATED_SECRET_BYTES = 32;

/** 비밀번호는 기본값이 없다 — 코드에 박힌 비밀번호는 레포를 읽는 누구나 아는 비밀번호다 */
async function readPasswordHash(env: Record<string, string | undefined>): Promise<string> {
  const plain = env.ADMIN_PASSWORD;
  const hash = env.ADMIN_PASSWORD_HASH;
  const hasPlain = plain !== undefined && plain !== "";
  const hasHash = hash !== undefined && hash !== "";
  if (hasPlain === hasHash) {
    throw new Error(
      "비밀번호는 ADMIN_PASSWORD(평문) 또는 ADMIN_PASSWORD_HASH 중 정확히 하나로 준다 — " +
        "레포 루트 .env에 ADMIN_PASSWORD=… 한 줄을 넣는다(# · 공백이 든 값은 큰따옴표로). " +
        "셸 환경 변수가 .env보다 우선한다 — 셸에 같은 이름(빈 값 포함)이 있는지 확인",
    );
  }
  if (hasPlain) return hashPassword(plain);
  // 틀린 해시로 뜨면 로그인만 영원히 401이다 — 원인이 보이는 시작 시점에 멈춘다
  if (!isValidPasswordHash(hash ?? "")) {
    throw new Error("ADMIN_PASSWORD_HASH 형식이 틀렸다 — hash-password.ts로 다시 만든다");
  }
  return hash ?? "";
}

export async function readLocalConfig(
  env: Record<string, string | undefined>,
): Promise<LocalConfig> {
  const passwordHash = await readPasswordHash(env);
  const username = env.ADMIN_USERNAME?.trim() || DEFAULT_USERNAME;
  const givenSecret = env.SESSION_SECRET;
  if (givenSecret !== undefined && givenSecret !== "") {
    return { username, passwordHash, sessionSecret: givenSecret, generatedSecret: false };
  }
  return {
    username,
    passwordHash,
    sessionSecret: randomBytes(GENERATED_SECRET_BYTES).toString("base64"),
    generatedSecret: true,
  };
}
