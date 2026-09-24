import type { Context } from "hono";

/** form-urlencoded 본문에서 문자열 값만 — 같은 이름이 여러 번 오면 마지막 값, `[]`로 끝나는 이름(배열)이나 파일은 버린다 */
export async function formStrings(c: Context): Promise<Record<string, string>> {
  const body = await c.req.parseBody();
  return Object.fromEntries(
    Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}
