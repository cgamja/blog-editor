import { createMemorySiteRebuildStore } from "./memory-site-rebuild-store";
import { createSiteRebuild } from "./site-rebuild";
import { SITE_REBUILD_DEBOUNCE_MS, SITE_REBUILD_STALE_MS } from "./site-rebuild-constants";

const HOOK_URL = "https://api.cloudflare.example/pages/deploy-hook/test-hook";
const BETWEEN_REQUESTS_MS = 10_000;

/** 훅 응답만 바꿔 끼운다 — 훅은 선언된 네트워크 경계라 fetch만 가짜로 둔다(상태 코드 또는 응답 함수) */
function setup(hook: number | (() => Promise<Response>)) {
  const store = createMemorySiteRebuildStore();
  const later: Promise<void>[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(
    typeof hook === "number" ? async () => new Response(null, { status: hook }) : hook,
  );
  let issued = 0;
  const rebuild = createSiteRebuild({
    hookUrl: HOOK_URL,
    store,
    runLater: (task) => {
      later.push(task);
    },
    fetch,
    newRequestId: () => `request-${++issued}`,
  });
  /** 뒤로 미룬 일(묶음 대기 → 훅)이 모두 끝날 때까지 기다린다 */
  const settle = () => Promise.all(later);
  return { rebuild, fetch, settle, store };
}

describe("site-rebuild — 묶어 보내기", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("WHEN 10초 간격으로 세 번 요청하면 THEN 마지막 요청 30초 뒤 훅 POST가 한 번이고 상태는 sent다", async () => {
    const { rebuild, fetch, settle } = setup(200);

    await rebuild.request();
    await vi.advanceTimersByTimeAsync(BETWEEN_REQUESTS_MS);
    await rebuild.request();
    await vi.advanceTimersByTimeAsync(BETWEEN_REQUESTS_MS);
    await rebuild.request();
    await vi.advanceTimersByTimeAsync(SITE_REBUILD_DEBOUNCE_MS - 1);

    expect(fetch).not.toHaveBeenCalled();
    expect((await rebuild.status()).status).toBe("pending");

    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(HOOK_URL, expect.objectContaining({ method: "POST" }));
    expect((await rebuild.status()).status).toBe("sent");
  });

  it("WHEN 훅이 500을 주면 THEN 상태는 failed다", async () => {
    const { rebuild, settle } = setup(500);

    await rebuild.request();
    await vi.advanceTimersByTimeAsync(SITE_REBUILD_DEBOUNCE_MS);
    await settle();

    expect((await rebuild.status()).status).toBe("failed");
  });

  // 다른 실패: fetch가 리다이렉트를 따라가면 3xx 뒤 다른 주소의 2xx를 sent로 적는다(POST가 GET으로 바뀌어 빌드가 안 돈다)
  it("WHEN 훅을 부르면 THEN 리다이렉트를 따라가지 않는다", async () => {
    const { rebuild, fetch } = setup(204);

    await rebuild.retry();

    expect(fetch).toHaveBeenCalledWith(HOOK_URL, expect.objectContaining({ redirect: "manual" }));
  });

  // 다시 시도는 묶지 않는다 — e2e는 이 경로를 네트워크 경계에서 가짜로 두므로 "바로 훅을 부른다"는 여기서만 잡힌다
  it("WHEN 다시 시도하고 훅이 2xx를 주면 THEN 기다리지 않고 훅 POST가 한 번이고 돌려받은 상태가 sent다", async () => {
    const { rebuild, fetch } = setup(204);

    const state = await rebuild.retry();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(HOOK_URL, expect.objectContaining({ method: "POST" }));
    expect(state.status).toBe("sent");
    expect(await rebuild.status()).toEqual(state);
  });

  // 다른 실패: fetch 거부가 묶음 대기 밖으로 새면 상태가 pending에 남는다(500 응답과 다른 경로)
  it("WHEN 훅 호출이 네트워크 오류로 거부되면 THEN 상태는 failed다", async () => {
    const { rebuild, settle } = setup(async () => {
      throw new TypeError("fetch failed");
    });

    await rebuild.request();
    await vi.advanceTimersByTimeAsync(SITE_REBUILD_DEBOUNCE_MS);
    await settle();

    expect((await rebuild.status()).status).toBe("failed");
  });

  it("WHEN 다시 시도의 훅을 기다리는 사이 새 요청이 오면 THEN 다시 시도의 결과가 새 pending을 덮지 않는다", async () => {
    let answerHook: (res: Response) => void = () => {};
    const { rebuild, store } = setup(
      () =>
        new Promise<Response>((resolve) => {
          answerHook = resolve;
        }),
    );

    const retrying = rebuild.retry();
    await vi.advanceTimersByTimeAsync(0);
    await rebuild.request();
    answerHook(new Response(null, { status: 204 }));
    const answered = await retrying;

    expect(await store.get()).toMatchObject({ status: "pending", requestId: "request-2" });
    // 화면은 retry 응답을 캐시에 넣는다 — 새 pending을 받아야 이어 읽기(폴링)가 멈추지 않는다
    expect(answered).toMatchObject({ status: "pending", requestId: "request-2" });
  });
});

describe("site-rebuild — 끝나지 않은 대기", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("WHEN pending이 1분 넘게 바뀌지 않았으면 THEN 상태는 failed다", async () => {
    const { rebuild, store } = setup(200);
    const now = new Date("2026-09-29T01:00:00.000Z");
    vi.setSystemTime(now);
    await store.put({
      status: "pending",
      requestId: "request-stuck",
      updatedAt: new Date(now.getTime() - SITE_REBUILD_STALE_MS - 1_000).toISOString(),
    });

    expect((await rebuild.status()).status).toBe("failed");
  });
});
