import type { ListDialog, PostSummary, PostTab, TabCounts } from "./types";

const notYet = (...input: unknown[]): never => {
  throw new Error(`미구현: ${JSON.stringify(input)}`);
};

export function tabOf(param: string | null): PostTab {
  return notYet(param);
}

export function countByTab(posts: readonly PostSummary[]): TabCounts {
  return notYet(posts.length);
}

export function postsOfTab(posts: readonly PostSummary[], tab: PostTab): PostSummary[] {
  return notYet(posts.length, tab);
}

export function sortByLastEdited(posts: readonly PostSummary[]): PostSummary[] {
  return notYet(posts.length);
}

export function lastEditedLabel(isoDate: string): string {
  return notYet(isoDate);
}

export function isAiDraft(post: PostSummary): boolean {
  return notYet(post.slug);
}

export function listDialogOf(param: string | null): ListDialog | null {
  return notYet(param);
}
