import { createAutosave, isSaveShortcut } from "./autosave";

const DELAY_MS = 2000;

function setup(options: { composing?: () => boolean } = {}) {
  const pending: Array<() => void> = [];
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        pending.push(resolve);
      }),
  );
  const autosave = createAutosave({
    delayMs: DELAY_MS,
    isComposing: options.composing ?? (() => false),
    save,
  });
  const finishSave = async () => {
    pending.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { autosave, save, finishSave };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("web-post-autosave — 자동 저장 시점", () => {
  it("WHEN 1초 간격으로 세 번 schedule하고 2초를 더 기다리면 THEN 저장은 한 번이다", async () => {
    const { autosave, save } = setup();

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("WHEN 조합 중인 채 2초가 지나고 조합이 끝난 뒤 2초가 더 지나면 THEN 뒤에 한 번만 저장한다", async () => {
    let composing = true;
    const { autosave, save } = setup({ composing: () => composing });

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(save).not.toHaveBeenCalled();

    composing = false;
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("WHEN 저장이 끝나기 전에 schedule하고 저장을 끝낸 뒤 2초를 기다리면 THEN 겹치지 않고 두 번 저장한다", async () => {
    const { autosave, save, finishSave } = setup();

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    await finishSave();
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("WHEN schedule 직후 flush하면 THEN 바로 한 번 저장하고 2초가 지나도 더 저장하지 않는다", async () => {
    const { autosave, save, finishSave } = setup();

    autosave.schedule();
    void autosave.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);

    await finishSave();
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("web-post-autosave — 저장 단축키", () => {
  const key = { code: "KeyS", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it("WHEN 한글 자판에서 ⌘S(key ㄴ)를 판정하면 THEN 저장이다", () => {
    expect(isSaveShortcut({ ...key, metaKey: true, key: "ㄴ" })).toBe(true);
  });

  it("WHEN Ctrl+Shift+S를 판정하면 THEN 저장이 아니다", () => {
    expect(isSaveShortcut({ ...key, ctrlKey: true, shiftKey: true, key: "S" })).toBe(false);
  });
});
