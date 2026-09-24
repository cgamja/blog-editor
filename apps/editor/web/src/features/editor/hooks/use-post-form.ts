import { useState } from "react";
import type { PostMeta } from "@blog-editor/content-schema";
import { suggestSlug } from "../slug";
import type { EditingStart } from "../types";

/** 「글 정보」에서 고치는 메타 — 제목은 `changeTitle`로만 바꾼다(주소 제안이 붙어서) */
export type EditableMeta = Partial<Omit<PostMeta, "title" | "draft" | "source">>;

/**
 * 편집 화면의 글 정보 입력 상태 — 메타와 주소 칸. 서버 저장은 `useServerSave`가 이 값을 읽어 보낸다.
 */
export function usePostForm(start: EditingStart) {
  const [meta, setMeta] = useState<PostMeta>(start.meta);
  const [slug, setSlug] = useState(start.slug);
  const [isSlugEdited, setSlugEdited] = useState(start.slug !== "");

  return {
    meta,
    slug,
    changeMeta: (patch: EditableMeta) => setMeta((previous) => ({ ...previous, ...patch })),
    /**
     * 제목을 바꾼다. 아직 서버에 없는 새 글이고 사람이 주소를 고친 적이 없으면 주소도 제목에서 제안한다
     * (디자인 결정 "새 글").
     */
    changeTitle: (title: string, isNewPost: boolean) => {
      setMeta((previous) => ({ ...previous, title }));
      if (isNewPost && !isSlugEdited) setSlug(suggestSlug(title));
    },
    changeSlug: (next: string) => {
      setSlug(next);
      setSlugEdited(true);
    },
  };
}

export type PostForm = ReturnType<typeof usePostForm>;
