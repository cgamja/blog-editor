import { useQueryClient } from "@tanstack/react-query";
import { AI_WRITE_DIALOG_TITLE, WriteWithAIDialog } from "../features/ai-write";
import { useWorkspaceSettings } from "../features/connect";
import { IMPORT_DIALOG_TITLE, ImportDialog } from "../features/import";
import { PostListPage, POSTS_QUERY_KEY } from "../features/posts";
import type { ListDialogComponents, ListDialogProps } from "../features/posts";
import { useWarmDisplayFont } from "../shared/ui/use-warm-display-font";

const LIST_DIALOG_TITLES = [IMPORT_DIALOG_TITLE, AI_WRITE_DIALOG_TITLE];

/** 대화상자가 고를 카테고리 — 설정을 불러오는 동안은 빈 목록(만들기 버튼이 꺼져 있다) */
function useCategories(): readonly string[] {
  return useWorkspaceSettings().data?.categories ?? [];
}

/** 가져오기 — 초안을 만들면 글 목록 캐시를 새로 고친다(목록 쿼리 키는 posts 기능의 것) */
function ImportListDialog({ onClose }: ListDialogProps) {
  const queryClient = useQueryClient();
  const categories = useCategories();
  return (
    <ImportDialog
      open
      onClose={onClose}
      categories={categories}
      onCreated={() => void queryClient.invalidateQueries({ queryKey: POSTS_QUERY_KEY })}
    />
  );
}

function WriteWithAIListDialog({ onClose }: ListDialogProps) {
  return <WriteWithAIDialog open onClose={onClose} categories={useCategories()} />;
}

/**
 * 목록에 꽂는 대화상자(#98) — 기능끼리 서로 import하지 않으므로(web 층 린트) 가져오기 · AI로 쓰기 · 설정을
 * 앱 층에서 조합한다. 목록은 `?dialog=`가 있을 때만 이 컴포넌트를 그린다.
 */
export const LIST_DIALOGS: ListDialogComponents = {
  import: ImportListDialog,
  "write-ai": WriteWithAIListDialog,
};

/** 대화상자를 꽂은 글 목록 — 대화상자는 열 때만 그려지므로 제목 글꼴 조각을 미리 받아 둔다(#107) */
export function PostListWithDialogs() {
  useWarmDisplayFont(LIST_DIALOG_TITLES);
  return <PostListPage dialogs={LIST_DIALOGS} />;
}
