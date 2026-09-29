import type { SiteRebuildState, SiteRebuildStore } from "./site-rebuild-store";

/** 저장 · 화면이 쓰는 재빌드 경계 — 앱은 이 셋만 안다(훅 · 묶음 대기는 밖) */
export interface SiteRebuild {
  /** 묶어 보내기: 상태를 pending으로 두고 대기 뒤 마지막 요청만 훅을 부른다 */
  request(): Promise<void>;
  /** 다시 시도: 묶지 않고 바로 훅을 불러 결과 상태를 준다 */
  retry(): Promise<SiteRebuildState>;
  status(): Promise<SiteRebuildState>;
}

export interface SiteRebuildOptions {
  hookUrl: string;
  store: SiteRebuildStore;
  /**
   * 응답 뒤에도 이어 돌 일을 맡긴다 — 로컬은 그냥 흘려보내고, 배포는 `waitUntil`에 건다.
   * 넘기는 일은 던지지 않는다(실패는 상태로 남는다)
   */
  runLater: (task: Promise<void>) => void;
  fetch?: typeof globalThis.fetch;
  newRequestId?: () => string;
}
