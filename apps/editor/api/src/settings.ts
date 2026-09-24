import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { settingsUpdateSchema } from "./contract/api-schemas";
import { MAX_SETTINGS_BODY_BYTES } from "./input-limits";
import { REQUEST_TOO_LARGE_MESSAGE, SETTINGS_BODY_MESSAGE } from "./messages";
import type { ConnectorInfo, SettingsStore } from "./settings-store";

const SETTINGS_PATH = "/api/settings";

/**
 * `GET` · `PUT /api/settings`(workspace-settings-api). 카테고리 · 연결 정보는 앱 설정이 원천이라 읽기만 한다
 * — 카테고리를 바꾸면 기존 글(발행 글 포함)의 저장 검증이 달라지므로 이관과 함께 따로 정한다.
 * 세션 확인은 `/api/*` 미들웨어가 한다.
 */
export function registerSettingsRoutes(
  app: Hono,
  options: {
    settings: SettingsStore;
    categories: readonly [string, ...string[]];
    connector: ConnectorInfo;
  },
): void {
  const { settings, categories, connector } = options;
  const respond = async () => ({ ...(await settings.get()), categories, connector });

  app.get(SETTINGS_PATH, async (c) => c.json(await respond()));

  app.put(
    SETTINGS_PATH,
    bodyLimit({
      maxSize: MAX_SETTINGS_BODY_BYTES,
      onError: (c) => c.json({ message: REQUEST_TOO_LARGE_MESSAGE }, 413),
    }),
    async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ message: SETTINGS_BODY_MESSAGE }, 400);
      }
      const parsed = settingsUpdateSchema.safeParse(body);
      if (!parsed.success) return c.json({ message: SETTINGS_BODY_MESSAGE }, 400);
      await settings.put(parsed.data);
      return c.json(await respond());
    },
  );
}
