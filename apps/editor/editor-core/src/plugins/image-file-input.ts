/** 파일에서 판정에 쓰는 부분만 — editor-core는 DOM 타입(File)을 모른다 */
export interface ImageFileLike {
  type: string;
  size: number;
}

export interface PastedContent {
  html: string;
  text: string;
}

const unimplemented = (...args: unknown[]): never => {
  void args;
  throw new Error("미구현");
};

export const imageFilesOf = <T extends ImageFileLike>(files: readonly T[]): T[] =>
  unimplemented(files);
export const shouldTakePastedFiles = (pasted: PastedContent): boolean => unimplemented(pasted);
