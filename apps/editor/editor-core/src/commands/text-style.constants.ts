import { PluginKey } from "@tiptap/pm/state";
import type { LastColor } from "./text-style.types";

/**
 * 마지막에 건 색(⌘⇧H)의 플러그인 키 — setTextStyle이 meta로 알리고, text-style-keymap의 플러그인이 기억한다.
 * 커맨드와 플러그인이 서로를 import하지 않게 키만 여기 둔다.
 * https://prosemirror.net/docs/ref/#state.PluginKey
 */
export const lastColorKey = new PluginKey<LastColor | null>("textStyleLastColor");
