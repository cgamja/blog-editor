import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  cancelImageUpload,
  failImageUpload,
  finishImageUpload,
  imageUploadsOf,
  startImageUpload,
} from "@blog-editor/editor-core";
import { prepareImage } from "./encode-image";
import { IMAGE_INSERT_MESSAGES } from "./image-insert-messages";
import type { ImageUploader } from "./image-upload-types";
import type { PlaceholderActions } from "./image-placeholder";
import { useCommandRunner } from "./use-command-runner";

/** 올리기 한 번의 시간 한도 — 넘으면 끊고 "서버에 닿지 못했어요"를 보인다 */
const UPLOAD_TIMEOUT_MS = 30_000;

export interface UploadQueue {
  enqueue: (files: readonly File[], gap: number) => void;
  actions: PlaceholderActions;
}

/** 한글 조합 중에는 문서를 바꾸지 않는다 — 조합이 끝난 뒤로 미룬다(.claude/rules/editor.md) */
function afterComposition(editor: Editor): Promise<void> {
  if (!editor.view.composing) return Promise.resolve();
  return new Promise((resolve) => {
    // compositionend 직후 ProseMirror가 조합 결과를 먼저 반영하도록 한 틱 뒤에 푼다
    editor.view.dom.addEventListener("compositionend", () => setTimeout(resolve, 0), {
      once: true,
    });
  });
}

/**
 * 이미지 올리기 줄(이슈 #92) — 파일마다 자리(장식)를 두고, 굽고, 올리고, 끝나면 그 자리에 넣는다. 한 장씩 순서대로.
 * 에디터가 바뀌거나 사라지면(key 재생성) 진행 중인 것을 끊고 더 이상 문서에 손대지 않는다. 한 장이 예외로 끝나도
 * 그 자리를 실패로 두고 줄은 계속 돈다. 파일은 다시 시도할 수 있게 자리가 있는 동안만 들고 있는다.
 */
export function useUploadQueue(editor: Editor, upload: ImageUploader | undefined): UploadQueue {
  // useCommandRunner: 초점을 옮기지 않고 editor-core 커맨드를 돌린다 — 올리기가 끝나도 쓰던 자리를 뺏지 않는다
  const run = useCommandRunner(editor);
  const files = useRef(new Map<string, File>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(0);
  const lifetime = useRef(new AbortController());
  // 부르는 쪽이 매 렌더 새 함수를 넘겨도 줄과 자리 플러그인을 다시 만들지 않게 최신 함수만 ref로 본다
  const uploadRef = useRef(upload);
  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const known = files.current;
    // 자리가 사라지면(지우기 · 가로지른 삭제 · 되돌리기) 들고 있던 파일도 놓는다
    const prune = () => {
      const alive = new Set(imageUploadsOf(editor.state).map((entry) => entry.id));
      for (const id of known.keys()) if (!alive.has(id)) known.delete(id);
    };
    editor.on("transaction", prune);
    return () => {
      controller.abort();
      editor.off("transaction", prune);
      known.clear();
      queue.current = Promise.resolve();
    };
  }, [editor]);

  const process = useCallback(
    async (id: string, signal: AbortSignal) => {
      const gone = () => signal.aborted || editor.isDestroyed;
      const file = files.current.get(id);
      const upload = uploadRef.current;
      if (file === undefined || upload === undefined || gone()) return;
      try {
        const prepared = await prepareImage(file);
        if (gone()) return;
        if (!prepared.ok) {
          run(failImageUpload(id, prepared.message));
          return;
        }
        const result = await upload(
          prepared.blob,
          AbortSignal.any([signal, AbortSignal.timeout(UPLOAD_TIMEOUT_MS)]),
        );
        if (gone()) return;
        if (!result.ok) {
          run(failImageUpload(id, result.message));
          return;
        }
        await afterComposition(editor);
        if (gone()) return;
        // 자리가 그새 지워졌으면 false — 끝난 결과는 버린다
        run(finishImageUpload(id, result.attrs));
      } catch {
        // 시간 초과 · 연결 끊김은 fetch가 던진다. 에디터가 사라져 끊긴 것이면 조용히 멈춘다
        if (!gone()) run(failImageUpload(id, IMAGE_INSERT_MESSAGES.networkFailed));
      }
    },
    [editor, run],
  );

  const enqueueOne = useCallback(
    (file: File, gap: number) => {
      const id = `image-${(nextId.current += 1)}`;
      if (!run(startImageUpload(id, gap))) return;
      files.current.set(id, file);
      const { signal } = lifetime.current;
      queue.current = queue.current.then(() => process(id, signal)).catch(() => undefined);
    },
    [process, run],
  );

  const enqueue = useCallback(
    (list: readonly File[], gap: number) => {
      for (const file of list) enqueueOne(file, gap);
    },
    [enqueueOne],
  );

  const actions = useMemo<PlaceholderActions>(
    () => ({
      retry: (id) => {
        const file = files.current.get(id);
        const entry = imageUploadsOf(editor.state).find((item) => item.id === id);
        if (file === undefined || entry === undefined) return;
        run(cancelImageUpload(id));
        enqueueOne(file, entry.pos);
      },
      remove: (id) => {
        run(cancelImageUpload(id));
      },
    }),
    [editor, enqueueOne, run],
  );

  return { enqueue, actions };
}
