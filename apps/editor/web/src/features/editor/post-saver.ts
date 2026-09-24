import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";
import type { DraftStore, EditingStart, SaveMode, SaveStatus } from "./types";

export interface PostSaverEvents {
  onStatus: (status: SaveStatus) => void;
  onAdopt: (slug: string) => void;
  onConflict: () => void;
  onExpiredChange: (isExpired: boolean) => void;
  onSlugError: (message: string | null) => void;
  onPublished: () => void;
}

export interface PostSaverDeps {
  getDoc: () => Doc;
  readForm: () => { meta: PostMeta; slug: string };
  savePost: (slug: string, file: PostFile, revision: string | null) => Promise<string>;
  renamePost: (from: string, to: string, revision: string) => Promise<string>;
  drafts: DraftStore;
  events: PostSaverEvents;
}

export interface PostSaver {
  save: (mode: SaveMode) => Promise<void>;
  isPublished: () => boolean;
}

export function createPostSaver(start: EditingStart, deps: PostSaverDeps): PostSaver {
  throw new Error(`미구현: ${start.slug} ${String(deps)}`);
}
