import { slugSchema } from "@blog-editor/content-schema";
import type { PostMeta } from "@blog-editor/content-schema";
import { META_FIELD_ORDER } from "./constants";
import type { MetaField } from "./types";

/**
 * 서버에 보내기 전 저장을 막는 빈칸. 서버 zod가 최종 검증하지만(카테고리 목록 등), 빈 새 글을 2초마다 보내
 * 400을 받는 대신 무엇을 채우면 저장되는지 머리줄에 먼저 알린다(edit-screen design 2).
 */
export function missingForSave(
  meta: Pick<PostMeta, "title" | "description" | "category">,
  slug: string,
): MetaField[] {
  const isBlank: Record<MetaField, boolean> = {
    title: meta.title.trim() === "",
    description: meta.description.trim() === "",
    category: meta.category.trim() === "",
    slug: !slugSchema.safeParse(slug).success,
  };
  return META_FIELD_ORDER.filter((field) => isBlank[field]);
}
