/** 연속 발행을 묶는 대기 — 마지막 요청 뒤 이만큼 조용하면 훅을 한 번 부른다(openspec site-rebuild) */
export const SITE_REBUILD_DEBOUNCE_MS = 30_000;
/** 훅 응답을 기다리는 한도 — 넘으면 failed */
export const SITE_BUILD_HOOK_TIMEOUT_MS = 10_000;
/**
 * pending이 이보다 오래되면 읽을 때 failed로 본다 — 묶음 대기 30초 + 훅 한도 10초 + 여유.
 * 함수 인스턴스가 대기 중에 내려가면 결과를 쓸 주체가 없어 pending이 영영 남기 때문이다(ADR-047)
 */
export const SITE_REBUILD_STALE_MS = 60_000;
