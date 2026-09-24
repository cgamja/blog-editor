/**
 * 붙여넣기 · 끌어다 놓기에서 이미지 파일만 가로챈다 — spec: editor-image-insert, image-insert design.md 3.
 * 어디에 넣을지(최상위 블록 사이 자리)만 정하고, 굽기 · 올리기는 onFiles를 준 쪽(editor-react)이 한다.
 * editor-core에는 DOM 타입(File · DataTransfer)이 없어 필요한 부분만 구조로 적는다. 근거 문서:
 * - EditorProps.handlePaste · handleDrop: https://prosemirror.net/docs/ref/#view.EditorProps.handlePaste ·
 *   https://prosemirror.net/docs/ref/#view.EditorProps.handleDrop — true를 돌리면 기본 붙여넣기 · 놓기를 막는다
 * - EditorView.posAtCoords · nodeDOM: https://prosemirror.net/docs/ref/#view.EditorView.posAtCoords
 */
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { nearestTopGap, topGapAfterSelection } from "./image-upload";

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

/** 클립보드 · 끌어 온 데이터에서 읽는 부분 — DataTransfer의 모양 */
interface TransferLike {
  files?: ArrayLike<unknown> | null;
  getData?: (format: string) => string;
}

interface PointerLike {
  clientX: number;
  clientY: number;
}

/** 서버가 받는 형식이 아니어도 브라우저가 풀 수 있으면 다시 구워 올린다(HEIC 등). SVG는 풀어도 막는다 */
const REFUSED_TYPES: ReadonlySet<string> = new Set(["image/svg+xml"]);

export function imageFilesOf<T extends ImageFileLike>(files: readonly T[]): T[] {
  return files.filter((file) => file.type.startsWith("image/") && !REFUSED_TYPES.has(file.type));
}

/** 이미지 하나를 복사할 때 브라우저가 싣는 겉 태그 — 이것만 걷어 내고 남은 것을 본다 */
const WRAPPER_TAGS = /<!--[\s\S]*?-->|<meta\b[^>]*>|<\/?(?:html|head|body)\b[^>]*>/gi;
const SINGLE_IMAGE = /^<img\b[^>]*>$/i;

/**
 * 붙여넣기에 이미지 파일이 있을 때 파일로 받을지. 스크린샷(글 없음)과 웹에서 이미지 하나만 복사한 경우(img 하나)는
 * 파일로 받는다. Excel · Word · Numbers는 글 · 표 HTML과 함께 미리보기 PNG를 싣는다 — 글이 있으면 글로 둔다.
 */
export function shouldTakePastedFiles({ html, text }: PastedContent): boolean {
  if (text.trim() !== "") return false;
  const rest = html.replace(WRAPPER_TAGS, "").trim();
  return rest === "" || SINGLE_IMAGE.test(rest);
}

function filesIn<T extends ImageFileLike>(transfer: TransferLike | null | undefined): T[] {
  return imageFilesOf(Array.from((transfer?.files ?? []) as ArrayLike<T>));
}

/** 놓은 좌표의 최상위 블록 위 · 아래 절반으로 자리를 고른다. 편집 영역 밖이면 null */
function dropGap(view: EditorView, event: PointerLike): number | null {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (found === null) return null;
  const { doc } = view.state;
  const $pos = doc.resolve(found.pos);
  if ($pos.depth === 0) return found.pos;
  const block = view.nodeDOM($pos.before(1)) as {
    getBoundingClientRect?: () => { top: number; height: number };
  } | null;
  const rect = block?.getBoundingClientRect?.();
  if (rect === undefined) return nearestTopGap(doc, found.pos, false);
  return nearestTopGap(doc, found.pos, event.clientY < rect.top + rect.height / 2);
}

export const imageFileInputKey = new PluginKey("imageFileInput");

export function imageFileInput<T extends ImageFileLike>({
  onFiles,
}: ImageFileInputOptions<T>): Plugin {
  return new Plugin({
    key: imageFileInputKey,
    props: {
      handlePaste(view, event) {
        const transfer = event.clipboardData as TransferLike | null;
        const files = filesIn<T>(transfer);
        if (files.length === 0) return false;
        const pasted = {
          html: transfer?.getData?.("text/html") ?? "",
          text: transfer?.getData?.("text/plain") ?? "",
        };
        if (!shouldTakePastedFiles(pasted)) return false;
        onFiles(files, topGapAfterSelection(view.state));
        return true;
      },
      handleDrop(view, event) {
        const files = filesIn<T>(event.dataTransfer as TransferLike | null);
        if (files.length === 0) return false;
        const gap = dropGap(view, event as PointerLike);
        if (gap !== null) onFiles(files, gap);
        return true;
      },
    },
  });
}
