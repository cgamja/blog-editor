/**
 * `SITE_BUILD_HOOK_URL` 해석 — 로컬(local-config) · 배포(edge-config) 진입점이 같은 규칙을 쓴다.
 * 없거나 빈 값이면 재빌드를 끈다(null). 훅 주소는 비밀이 든 URL이라 https만 받는다 — 틀린 값으로 뜨면
 * 발행할 때마다 조용히 failed다
 */
export function readSiteBuildHookUrl(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("SITE_BUILD_HOOK_URL은 https: 주소다 — URL로 읽히지 않는다");
  }
  if (url.protocol !== "https:") {
    throw new Error(`SITE_BUILD_HOOK_URL은 https: 주소다 — 받은 스킴: "${url.protocol}"`);
  }
  return url.href;
}
