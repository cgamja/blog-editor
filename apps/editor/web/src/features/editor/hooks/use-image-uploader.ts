import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { uploadResultFrom } from "@blog-editor/editor-react";
import type { ImageUploader } from "@blog-editor/editor-react";
import { IMAGE_UPLOAD_PATH } from "../constants";

async function jsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function uploadImage({ blob, signal }: { blob: Blob; signal: AbortSignal }) {
  const response = await fetch(IMAGE_UPLOAD_PATH, {
    method: "POST",
    body: blob,
    headers: { "Content-Type": blob.type },
    signal,
  });
  // 상태 코드 해석(401 · 413 · 415 · 422 문장)은 editor-react가 한 곳에서 한다 — 여기서 던지지 않는다
  return uploadResultFrom(response.status, response.ok, await jsonOrNull(response));
}

/**
 * 에디터 이미지 올리기(`POST /api/images`, ADR-021). editor-react는 서버를 모르고 이 함수를 받기만 한다.
 * 굽기 · 줄 세우기 · 실패 표시는 editor-react의 올리기 줄이 맡는다.
 */
export function useImageUploader(): ImageUploader {
  const { mutateAsync } = useMutation({ mutationFn: uploadImage });
  return useCallback((blob, signal) => mutateAsync({ blob, signal }), [mutateAsync]);
}
