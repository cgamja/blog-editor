/**
 * 굽은 이미지를 `POST /api/images`로 올린다(spec: image-upload-api). 세션 쿠키를 함께 보낸다.
 * https://developer.mozilla.org/docs/Web/API/Fetch_API
 */
import type { UploadedImageAttrs } from "@blog-editor/editor-core";
import { imageAttrsFrom, uploadErrorMessage } from "./image-insert-model";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";

export type UploadResult = { ok: true; attrs: UploadedImageAttrs } | { ok: false; message: string };

/** 에디터와 API는 같은 출처다(로컬은 vite 프록시, 배포는 같은 도메인) */
export const IMAGE_UPLOAD_ENDPOINT = "/api/images";

async function jsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function uploadImage(blob: Blob): Promise<UploadResult> {
  let response: Response;
  try {
    response = await fetch(IMAGE_UPLOAD_ENDPOINT, {
      method: "POST",
      body: blob,
      headers: { "Content-Type": blob.type },
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, message: IMAGE_INSERT_MESSAGES.networkFailed };
  }
  const body = await jsonOrNull(response);
  if (!response.ok) return { ok: false, message: uploadErrorMessage(response.status, body) };
  const attrs = imageAttrsFrom(body);
  return attrs === null
    ? { ok: false, message: IMAGE_INSERT_MESSAGES.uploadFailed }
    : { ok: true, attrs };
}
