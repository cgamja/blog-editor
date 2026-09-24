import { generatePath } from "react-router";
import { ROUTES } from "./constants";

/** 글 편집 화면 경로 — slug는 소문자 · 숫자 · 하이픈이라 그대로 들어가지만 generatePath가 인코딩까지 맡는다 */
export const editPostPath = (slug: string) => generatePath(ROUTES.editPost, { slug });
