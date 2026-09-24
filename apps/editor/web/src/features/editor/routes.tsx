import type { RouteObject } from "react-router";
import { ROUTES } from "../../shared/routes/constants";
import { EditPostPage } from "./pages/EditPostPage";

/**
 * 편집 화면 라우트 — 내비 없는 전체 화면이라 앱 셸 밖, 가드(`RequireSession`) 안에 둔다.
 * 경로 없는 레이아웃 하나가 두 경로를 감싸 새 글 → 첫 저장에서 에디터를 다시 만들지 않는다(design 1).
 */
export const editorRoutes: RouteObject[] = [
  {
    element: <EditPostPage />,
    children: [{ path: ROUTES.newPost }, { path: ROUTES.editPost }],
  },
];
