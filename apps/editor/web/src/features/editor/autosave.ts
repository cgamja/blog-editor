import type { SaveMode } from "./types";

export interface AutosaveOptions {
  delayMs: number;
  /** 한글 조합 중이면 true — 그 사이에는 문서를 읽어 보내지 않는다(CLAUDE.md `view.composing`) */
  isComposing: () => boolean;
  save: (mode: SaveMode) => Promise<void>;
}

export interface Autosave {
  /** 바뀌었다 — 시계를 다시 맞춘다 */
  schedule: () => void;
  /** 기다리지 않고 저장한다(⌘S · 「초안 저장」) */
  flush: () => Promise<void>;
  /** 이 방식으로 저장한다 — 자동 저장과 같은 줄에 선다(발행 · 덮어쓰기) */
  run: (mode: SaveMode) => Promise<void>;
  dispose: () => void;
}

export type ShortcutKey = Pick<
  KeyboardEvent,
  "code" | "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

/**
 * 저장 줄(디자인 결정 4-A: 입력 멈추고 2초). 자동 저장 · ⌘S · 발행 · 덮어쓰기가 모두 이 줄 하나에 서서
 * 같은 ETag로 PUT이 겹치지 않는다. 조합 중이면 시각이 와도 · 바로 저장이어도 조합이 끝날 때까지 미룬다.
 * 저장 중에 또 바뀌면 줄이 빈 뒤 한 번 더 시계를 맞춘다.
 */
export function createAutosave({ delayMs, isComposing, save }: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let queued = 0;
  let hasPendingChange = false;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const untilNotComposing = () =>
    new Promise<void>((resolve) => {
      const check = () => {
        if (isComposing()) setTimeout(check, delayMs);
        else resolve();
      };
      check();
    });

  const run = (mode: SaveMode): Promise<void> => {
    clearTimer();
    hasPendingChange = false;
    queued += 1;
    const task = queue.then(untilNotComposing).then(() => save(mode));
    queue = task
      .catch(() => undefined)
      .finally(() => {
        queued -= 1;
        if (queued === 0 && hasPendingChange) schedule();
      });
    return task;
  };

  const fire = () => {
    timer = null;
    void run("draft").catch(() => undefined);
  };

  function schedule() {
    clearTimer();
    if (queued > 0) {
      hasPendingChange = true;
      return;
    }
    timer = setTimeout(fire, delayMs);
  }

  return {
    schedule,
    flush: () => run("draft"),
    run,
    dispose: clearTimer,
  };
}

/** ⌘S · Ctrl+S — 한글 자판에서는 `key`가 "ㄴ"이라 물리 키 `code`로 본다 */
export function isSaveShortcut(event: ShortcutKey): boolean {
  const hasCommand = event.metaKey !== event.ctrlKey;
  return event.code === "KeyS" && hasCommand && !event.shiftKey && !event.altKey;
}
