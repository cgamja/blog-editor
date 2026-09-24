import type { SaveErrorKind, SaveStatus } from "./types";

export function saveHeadersOf(revision: string | null): Record<string, string> {
  throw new Error(`미구현: ${String(revision)}`);
}

export function saveErrorKindOf(error: unknown, isNew: boolean): SaveErrorKind {
  throw new Error(`미구현: ${String(error)} ${String(isNew)}`);
}

export function saveStatusText(status: SaveStatus): string {
  throw new Error(`미구현: ${status.kind}`);
}
