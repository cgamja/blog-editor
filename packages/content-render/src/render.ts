import type { PostFile } from "@blog-editor/content-schema";

/** 이미지 · 스티커 경로 앞에 붙는 도메인(plan 3-8). 문서에는 경로만 있다. */
export interface RenderOptions {
  imageBaseUrl: string;
}

export function renderHtml(file: Pick<PostFile, "doc">, options: RenderOptions): string {
  throw new Error(`renderHtml: not implemented (${file.doc.type}, ${options.imageBaseUrl})`);
}
