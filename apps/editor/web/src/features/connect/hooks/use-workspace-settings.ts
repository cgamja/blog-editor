import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, saveGuide } from "../api";
import { SETTINGS_QUERY_KEY } from "../constants";

/** 워크스페이스 설정 — AI 연결 화면이 쓰고, 앱이 대화상자에 카테고리를 넘길 때도 쓴다 */
export function useWorkspaceSettings() {
  return useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: fetchSettings });
}

/** 가이드 저장 — 응답이 저장한 뒤의 설정이라 그대로 캐시에 넣는다 */
export function useSaveGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveGuide,
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_QUERY_KEY, settings),
  });
}
