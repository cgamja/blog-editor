import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ROUTES } from "../../../shared/routes/constants";
import { logout } from "../api";
import { markSignedOut } from "../session-cache";

/**
 * 로그아웃 — 로그인 화면으로 먼저 옮긴 뒤 캐시를 비운다. 순서가 반대면 가드가 지금 경로를 `next`로 붙여
 * 다음 로그인이 로그아웃했던 화면으로 돌아간다. 요청이 실패해도(네트워크) 화면은 로그인으로 간다 —
 * 서버 쪽은 멱등이라 다음 로그인이 쿠키를 덮는다.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSettled: async () => {
      await navigate(ROUTES.login, { replace: true });
      markSignedOut(queryClient);
    },
  });
}
