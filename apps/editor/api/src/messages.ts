import { IMAGE_MAX_BYTES, NATURAL_SIZE_RANGE } from "@blog-editor/content-schema";
import { MAX_GUIDE_LENGTH, MAX_MARKDOWN_LENGTH } from "./input-limits";

const BYTES_PER_MB = 1024 * 1024;

/** API 응답의 `message` — 에디터 화면(M3)이 그대로 보여 줄 문장이라 한 곳에 모은다. */
export const INVALID_SLUG_MESSAGE = "slug는 소문자·숫자·하이픈만";
export const POST_NOT_FOUND_MESSAGE = "글이 없다";
export const PRECONDITION_REQUIRED_MESSAGE =
  "새 글은 If-None-Match: *, 고치기는 If-Match: <ETag>가 필요하다";
export const BODY_NOT_JSON_MESSAGE = "본문이 JSON이 아니다";
export const SCHEMA_MISMATCH_MESSAGE = "문서가 스키마에 맞지 않는다";
export const CONFLICT_MESSAGE = "다른 곳에서 수정됐다 — 다시 불러온 뒤 저장한다";
export const LOGIN_BODY_MESSAGE = "username과 password 문자열이 필요하다";
export const LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호가 맞지 않는다";
export const UNAUTHORIZED_MESSAGE = "로그인이 필요하다";
export const IMAGE_TOO_LARGE_MESSAGE = `이미지는 ${IMAGE_MAX_BYTES / BYTES_PER_MB}MB 이하만 올릴 수 있다`;
export const IMAGE_FORMAT_MESSAGE = "JPEG · PNG · WebP · GIF 이미지만 올릴 수 있다";
export const IMAGE_TOO_WIDE_MESSAGE = `긴 변을 ${NATURAL_SIZE_RANGE.max}px 이하로 줄여서 올린다`;
export const IMAGE_ROTATED_MESSAGE =
  "사진 방향(EXIF)이 돌아가 있다 — 방향을 적용해 다시 그린 뒤 올린다";
export const SETTINGS_BODY_MESSAGE = `설정은 { guide } 하나만 — 가이드는 ${MAX_GUIDE_LENGTH.toLocaleString("ko-KR")}자까지`;
export const IMPORT_BODY_MESSAGE = `markdown 문자열이 필요하다 — ${MAX_MARKDOWN_LENGTH.toLocaleString("ko-KR")}자까지`;
export const REQUEST_TOO_LARGE_MESSAGE = "요청 본문이 너무 크다";
