import type { UploadedImageAttrs } from "@blog-editor/editor-core";

export interface Size {
  width: number;
  height: number;
}

/** 파일에서 판정에 쓰는 부분만 — node 테스트가 File 없이 부를 수 있게 */
export interface FileLike {
  type: string;
  size: number;
}

const unimplemented = (...args: unknown[]): never => {
  void args;
  throw new Error("미구현");
};

export const fitWithin = (size: Size): Size => unimplemented(size);
export const nextQuality = (previous: number | null): number | null => unimplemented(previous);
export const passesThrough = (file: FileLike, size: Size): boolean => unimplemented(file, size);
export const imageAttrsFrom = (body: unknown): UploadedImageAttrs | null => unimplemented(body);
export const uploadErrorMessage = (status: number, body: unknown): string =>
  unimplemented(status, body);
export const imageFilesOf = <T extends FileLike>(files: readonly T[]): T[] => unimplemented(files);
