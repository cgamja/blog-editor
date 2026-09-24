/** 파일에서 판정에 쓰는 부분만 — editor-core는 DOM 타입(File)을 모른다 */
export interface ImageFileLike {
  type: string;
  size: number;
}

export interface PastedContent {
  html: string;
  text: string;
}

export interface ImageFileInputOptions<T extends ImageFileLike> {
  /** 이미지 파일과 넣을 자리. 부르는 쪽이 순서대로 올린다 */
  onFiles: (files: T[], gap: number) => void;
}
