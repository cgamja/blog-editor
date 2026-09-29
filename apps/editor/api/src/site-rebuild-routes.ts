import type { Hono } from "hono";
import { SITE_REBUILD_OFF_MESSAGE } from "./messages";
import type { SiteRebuildState } from "./site-rebuild-store";
import type { SiteRebuild } from "./site-rebuild-types";

const PATH = "/api/site-rebuild";

/** 화면에 주는 모양 — 요청 id는 묶기 판정용이라 내보내지 않는다 */
function bodyOf(state: SiteRebuildState) {
  return { status: state.status, updatedAt: state.updatedAt };
}

/**
 * 편집 화면의 사이트 반영 상태 · 다시 시도(openspec site-rebuild). `/api/*` 세션 검사 아래에 있다.
 * 훅이 없으면 GET은 `off`, POST는 404 — 라우트는 늘 있어 계약의 라우트 집합이 옵션으로 바뀌지 않는다
 */
export function registerSiteRebuildRoutes(app: Hono, siteRebuild: SiteRebuild | undefined): void {
  app.get(PATH, async (c) => {
    if (siteRebuild === undefined) return c.json({ status: "off", updatedAt: null });
    return c.json(bodyOf(await siteRebuild.status()));
  });

  app.post(PATH, async (c) => {
    if (siteRebuild === undefined) return c.json({ message: SITE_REBUILD_OFF_MESSAGE }, 404);
    return c.json(bodyOf(await siteRebuild.retry()));
  });
}
