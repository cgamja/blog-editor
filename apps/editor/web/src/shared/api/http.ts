export function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  throw new Error(`미구현: ${path} ${init?.method ?? "GET"}`);
}
