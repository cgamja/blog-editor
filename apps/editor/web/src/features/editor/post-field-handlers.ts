import type { Autosave } from "./autosave";
import type { PostForm } from "./hooks/use-post-form";
import type { ServerSave } from "./hooks/use-server-save";
import type { EditableMeta } from "./types";

export interface PostFieldHandlersOptions {
  form: PostForm;
  server: ServerSave;
  autosave: Autosave;
}

/** 제목 · 글 정보 · 주소 입력 — 고치면 폼에 담고 자동 저장을 맞춘다 */
export function createPostFieldHandlers({ form, server, autosave }: PostFieldHandlersOptions) {
  return {
    handleMetaChange: (patch: EditableMeta) => {
      form.changeMeta(patch);
      autosave.schedule();
    },
    handleTitleChange: (title: string) => {
      form.changeTitle(title, server.savedSlug() === null);
      autosave.schedule();
    },
    handleSlugChange: (slug: string) => {
      form.changeSlug(slug);
      server.clearSlugError();
      autosave.schedule();
    },
  };
}
