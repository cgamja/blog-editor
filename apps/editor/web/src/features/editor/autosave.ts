export interface AutosaveOptions {
  delayMs: number;
  /** 한글 조합 중이면 true — 그 사이에는 문서를 읽어 보내지 않는다(CLAUDE.md `view.composing`) */
  isComposing: () => boolean;
  save: () => Promise<void>;
}

export interface Autosave {
  /** 바뀌었다 — 시계를 다시 맞춘다 */
  schedule: () => void;
  /** 기다리지 않고 저장한다(⌘S · 「초안 저장」) */
  flush: () => Promise<void>;
  dispose: () => void;
}

export type ShortcutKey = Pick<
  KeyboardEvent,
  "code" | "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

/**
 * 자동 저장 시점(디자인 결정 4-A: 입력 멈추고 2초). 저장은 한 번에 하나 — 저장 중에 바뀌면 끝난 뒤 한 번 더.
 */
export function createAutosave({ delayMs, isComposing, save }: AutosaveOptions): Autosave {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let hasPendingChange = false;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const run = async (): Promise<void> => {
    if (inFlight !== null) {
      hasPendingChange = true;
      return inFlight;
    }
    hasPendingChange = false;
    inFlight = save().finally(() => {
      inFlight = null;
      if (hasPendingChange) schedule();
    });
    return inFlight;
  };

  const fire = () => {
    timer = null;
    if (isComposing()) {
      timer = setTimeout(fire, delayMs);
      return;
    }
    void run().catch(() => undefined);
  };

  function schedule() {
    clearTimer();
    if (inFlight !== null) {
      hasPendingChange = true;
      return;
    }
    timer = setTimeout(fire, delayMs);
  }

  return {
    schedule,
    flush: () => {
      clearTimer();
      return run();
    },
    dispose: clearTimer,
  };
}

/** ⌘S · Ctrl+S — 한글 자판에서는 `key`가 "ㄴ"이라 물리 키 `code`로 본다 */
export function isSaveShortcut(event: ShortcutKey): boolean {
  const hasCommand = event.metaKey !== event.ctrlKey;
  return event.code === "KeyS" && hasCommand && !event.shiftKey && !event.altKey;
}
