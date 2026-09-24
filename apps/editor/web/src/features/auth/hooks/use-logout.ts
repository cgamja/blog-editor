import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ROUTES } from "../../../shared/routes/constants";
import { logout } from "../api";
import { markSignedOut } from "../session-cache";

/**
 * 로그아웃 — 서버가 쿠키를 지웠을 때만 로그인 화면으로 옮기고 캐시를 비운다. 이동을 먼저 해야 가드가 지금 경로를
 * `next`로 붙이지 않는다. 요청이 실패하면(네트워크 · 5xx) 쿠키가 아직 유효하므로 화면도 세션도 그대로 두고
 * 호출한 쪽이 `isError`로 다시 시도를 보인다 — 로그인 화면으로 보내면 로그아웃된 줄 알고 자리를 뜬다.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await navigate(ROUTES.login, { replace: true });
      markSignedOut(queryClient);
    },
  });
}
