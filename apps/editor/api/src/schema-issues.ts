import type { ZodError } from "zod";

/** 400 응답의 `issues` — zod 이슈의 경로와 메시지(SchemaErrorBody) */
export function issuesOf(error: ZodError) {
  return error.issues.map(({ path, message }) => ({
    path: path.map((key) => (typeof key === "symbol" ? String(key) : key)),
    message,
  }));
}
