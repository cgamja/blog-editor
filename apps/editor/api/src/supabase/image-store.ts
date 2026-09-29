import type { SupabaseClient } from "@supabase/supabase-js";
import { isImageName } from "../image-store";
import type { ImageStore } from "../image-store";

/** 비공개 버킷(ADR-021 · ADR-044) — 공개 URL이 없고 API가 보안 헤더를 붙여 내준다. 객체는 맨 위 `<이름>`이다 */
const IMAGE_BUCKET = "images";
/** 없는 객체 — Storage는 HTTP 400에 statusCode "404"(NoSuchKey)로 답한다(실측 2026-09-28) */
const NOT_FOUND = "404";

function isNotFound(error: {
  status: number | undefined;
  statusCode: string | undefined;
}): boolean {
  return error.statusCode === NOT_FOUND || error.status === Number(NOT_FOUND);
}

/**
 * 배포용 이미지 저장소(ADR-021 · ADR-044) — Supabase Storage. 이름 모양을 다시 확인한다(라우트가 이미 거르지만
 * 저장소도 믿지 않는다 — file-image-store와 같은 관례).
 */
export function createSupabaseImageStore(options: { client: SupabaseClient }): ImageStore {
  const bucket = () => options.client.storage.from(IMAGE_BUCKET);

  return {
    async has(name) {
      if (!isImageName(name)) return false;
      // 없으면 data false(오류 동봉), 그 밖의 오류는 던진다(storage-js exists)
      const { data } = await bucket().exists(name);
      return data;
    },
    async put(name, bytes, contentType) {
      if (!isImageName(name)) throw new Error(`이미지 이름 모양이 아니다 — ${name}`);
      // 같은 이름은 같은 내용이라 덮어써도 된다
      const { error } = await bucket().upload(name, bytes, { contentType, upsert: true });
      if (error !== null) throw error;
    },
    async get(name) {
      if (!isImageName(name)) return null;
      const { data, error } = await bucket().download(name);
      if (error !== null) {
        if (isNotFound(error)) return null;
        throw error;
      }
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
