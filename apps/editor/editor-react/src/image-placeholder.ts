/**
 * 올리는 중 자리의 DOM(widget) — 문서가 아니라 장식이라 ProseMirror가 편집하지 않는다(contenteditable=false).
 * 실패하면 이유와 「다시 시도」 · 「지우기」를 보인다. 버튼은 업로드 상태(파일)를 가진 훅의 함수를 부른다.
 * https://prosemirror.net/docs/ref/#view.Decoration^widget
 */
import type { ImageUploadEntry, ImageUploadRender } from "@blog-editor/editor-core";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";

export interface PlaceholderActions {
  retry: (id: string) => void;
  remove: (id: string) => void;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  // 누르는 동안 편집 영역의 선택이 풀리지 않게 한다
  element.addEventListener("mousedown", (event) => event.preventDefault());
  element.addEventListener("click", onClick);
  return element;
}

function placeholderElement(entry: ImageUploadEntry, actions: PlaceholderActions): HTMLElement {
  const root = document.createElement("div");
  root.className = "image-upload-placeholder";
  root.contentEditable = "false";
  root.dataset.status = entry.status;
  const text = document.createElement("p");
  if (entry.status === "uploading") {
    root.setAttribute("role", "status");
    text.textContent = IMAGE_INSERT_MESSAGES.uploading;
    root.append(text);
    return root;
  }
  root.setAttribute("role", "alert");
  text.textContent = entry.message ?? IMAGE_INSERT_MESSAGES.uploadFailed;
  const buttons = document.createElement("div");
  buttons.className = "image-upload-placeholder-actions";
  buttons.append(
    button(IMAGE_INSERT_MESSAGES.retry, () => actions.retry(entry.id)),
    button(IMAGE_INSERT_MESSAGES.remove, () => actions.remove(entry.id)),
  );
  root.append(text, buttons);
  return root;
}

export function placeholderRenderer(actions: PlaceholderActions): ImageUploadRender {
  return (entry) => () => placeholderElement(entry, actions);
}
