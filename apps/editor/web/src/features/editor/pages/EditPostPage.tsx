import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { EditSession } from "../components/EditSession";
import { NEW_POST_KEY, POST_CSS_PATH } from "../constants";
import { adoptSlug, nextEditingSession } from "../editing-session";
import { editPathOf } from "../routes-path";
import type { EditingSession } from "../types";
import "@blog-editor/editor-react/editor.css";
import "@blog-editor/editor-react/editor-screen.css";
import "@blog-editor/editor-react/text-toolbar.css";
import "../editor-page.css";

/**
 * `/posts/new` · `/posts/:slug/edit`의 레이아웃 라우트(edit-screen design 1). 두 경로 사이를 오가도 이 컴포넌트는
 * 그대로라, 화면이 스스로 옮긴 주소(첫 저장 · 주소 바꾸기)에서는 편집 세션을 이어 간다.
 */
export function EditPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const routeKey = slug ?? NEW_POST_KEY;
  const [session, setSession] = useState<EditingSession>({
    routeKey,
    sessionKey: routeKey,
    adopted: null,
  });
  const current = nextEditingSession(session, routeKey);
  // 렌더 중 상태 갱신 — 경로가 바뀐 그 렌더에서 세션을 정한다(React: 이전 prop 저장 패턴)
  if (current !== session) setSession(current);

  const handleAdopt = useCallback(
    (next: string) => {
      setSession((previous) => adoptSlug(previous, next));
      void navigate(editPathOf(next), { replace: true });
    },
    [navigate],
  );

  return (
    <>
      {/* 본문 모양은 공개 페이지와 같은 post.css — web은 content-render를 import하지 않는다(adr-009) */}
      <link rel="stylesheet" href={POST_CSS_PATH} precedence="default" />
      <EditSession
        key={current.sessionKey}
        initialSlug={current.sessionKey === NEW_POST_KEY ? null : current.sessionKey}
        onAdopt={handleAdopt}
      />
    </>
  );
}
