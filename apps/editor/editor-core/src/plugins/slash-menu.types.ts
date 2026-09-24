/** 슬래시 메뉴의 공개 타입 — spec: editor-slash-menu. 플러그인은 slash-menu.ts */

/** 슬래시 메뉴 상태. `from`은 `/`의 위치, `query`는 `/` 뒤부터 커서까지의 글자 */
export interface SlashMenuState {
  from: number;
  query: string;
}

export interface SlashMenuOptions {
  /** 열려 있을 때 방향키 · Enter · Tab을 받는 UI 처리기. 처리했으면 true */
  onKey?: ((key: string) => boolean) | undefined;
}

/** UI가 키 처리기를 꽂는 자리(extension storage) */
export interface SlashMenuStorage {
  onKey: ((key: string) => boolean) | null;
}
