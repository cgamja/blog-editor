import { PluginKey } from "@tiptap/pm/state";
import type { Command, Plugin } from "@tiptap/pm/state";

/** 슬래시 메뉴 상태 — spec: editor-slash-menu. `from`은 `/`의 위치 */
export interface SlashMenuState {
  from: number;
  query: string;
}

export interface SlashMenuOptions {
  /** 열려 있을 때 방향키 · Enter · Tab을 받는 UI 처리기 */
  onKey?: ((key: string) => boolean) | undefined;
}

export const slashMenuKey = new PluginKey<SlashMenuState | null>("slashMenu");

export function slashMenu(options: SlashMenuOptions = {}): Plugin {
  throw new Error(`미구현: ${Object.keys(options).join(",")}`);
}

export const closeSlashMenu: Command = () => {
  throw new Error("미구현");
};
