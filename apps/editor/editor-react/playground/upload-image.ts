/**
 * 플레이그라운드의 이미지 올리기 — 로컬 API(`POST /api/images`, vite 프록시)에 세션 쿠키와 함께 보낸다.
 * editor-react는 서버를 모르고 이 함수를 받기만 한다(web은 TanStack Query 뮤테이션으로 같은 모양을 준다).
 * https://developer.mozilla.org/docs/Web/API/Fetch_API
 */
import { uploadResultFrom } from "../src";
import type { ImageUploader } from "../src";

const IMAGE_UPLOAD_ENDPOINT = "/api/images";

async function jsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const uploadImage: ImageUploader = async (blob, signal) => {
  const response = await fetch(IMAGE_UPLOAD_ENDPOINT, {
    method: "POST",
    body: blob,
    headers: { "Content-Type": blob.type },
    credentials: "same-origin",
    signal,
  });
  return uploadResultFrom(response.status, response.ok, await jsonOrNull(response));
};
