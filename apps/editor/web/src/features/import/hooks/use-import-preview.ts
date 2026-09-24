import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "../../../shared/api/errors";
import { previewImport } from "../api";
import { IMPORT_PREVIEW_QUERY_KEY, PREVIEW_DEBOUNCE_MS, PREVIEW_MAX_RETRIES } from "../constants";

const HTTP_SERVER_ERROR_MIN = 500;

/** 4xx(길이 초과 · 틀린 요청)는 다시 보내도 같다 — 네트워크 · 5xx만 다시 묻는다 */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < HTTP_SERVER_ERROR_MIN) return false;
  return failureCount < PREVIEW_MAX_RETRIES;
}

/**
 * 입력이 멈추면 미리보기를 부른다. 새 입력이 오면 앞 요청은 TanStack Query가 signal로 끊고,
 * 새 결과가 올 때까지 앞 결과를 보여 준다(빈 화면 깜빡임 없이).
 */
export function useImportPreview(markdown: string) {
  const [settled, setSettled] = useState(markdown);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(markdown), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [markdown]);

  const hasText = settled.trim() !== "";
  const query = useQuery({
    queryKey: [IMPORT_PREVIEW_QUERY_KEY, settled],
    queryFn: ({ signal }) => previewImport(settled, signal),
    enabled: hasText,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: shouldRetry,
  });
  return { ...query, isSettled: settled === markdown, hasText };
}
