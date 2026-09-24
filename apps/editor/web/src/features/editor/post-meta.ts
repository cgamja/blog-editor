import type { PostMeta } from "@blog-editor/content-schema";
import type { MetaField } from "./types";

export function missingForSave(
  meta: Pick<PostMeta, "title" | "description" | "category">,
  slug: string,
): MetaField[] {
  throw new Error(`미구현: ${meta.title} ${slug}`);
}
