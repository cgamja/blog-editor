export interface AutosaveOptions {
  delayMs: number;
  isComposing: () => boolean;
  save: () => Promise<void>;
}

export interface Autosave {
  schedule: () => void;
  flush: () => Promise<void>;
  dispose: () => void;
}

export type ShortcutKey = Pick<
  KeyboardEvent,
  "code" | "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

export function createAutosave(options: AutosaveOptions): Autosave {
  throw new Error(`미구현: ${options.delayMs}`);
}

export function isSaveShortcut(event: ShortcutKey): boolean {
  throw new Error(`미구현: ${event.code}`);
}
