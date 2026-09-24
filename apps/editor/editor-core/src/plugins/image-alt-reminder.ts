import { PluginKey } from "@tiptap/pm/state";
import type { Plugin } from "@tiptap/pm/state";

export const ALT_MISSING_ATTR = "data-alt-missing";

export const imageAltReminderKey = new PluginKey("imageAltReminder");

export function imageAltReminder(): Plugin {
  throw new Error("미구현");
}
