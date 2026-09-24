import type { EditingSession } from "./types";

export function nextEditingSession(state: EditingSession, routeKey: string): EditingSession {
  throw new Error(`미구현: ${state.sessionKey} ${routeKey}`);
}

export function adoptSlug(state: EditingSession, slug: string): EditingSession {
  throw new Error(`미구현: ${state.sessionKey} ${slug}`);
}
