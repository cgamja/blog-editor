export type SessionState = "authenticated" | "anonymous" | "error";

export function sessionStateOf(status: number): SessionState {
  throw new Error(`미구현: ${status}`);
}
