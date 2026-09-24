import type { LocalDraft, RestoreDecision } from "./types";

export function restoreDecisionOf(
  local: LocalDraft | null,
  serverRevision: string,
): RestoreDecision {
  throw new Error(`미구현: ${String(local?.baseRevision)} ${serverRevision}`);
}
