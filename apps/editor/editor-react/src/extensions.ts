import { Extension, type AnyExtension } from "@tiptap/core";
import {
  backspaceAfterCustomBlock,
  blockGuard,
  editorExtensions,
  History,
  MarkdownShortcuts,
  motionPreview,
  MoveBlock,
} from "@blog-editor/editor-core";

// 코어 Keymap(우선순위 100)의 Backspace(joinBackward)보다 먼저 본다 — 커맨드가 false면 코어로 넘어간다
const CUSTOM_BLOCK_KEYS_PRIORITY = 1000;

/**
 * 편집 중 닫힌 집합을 지키는 blockGuard를 싣는다(spec: editor-block-guard). 등록만 한다(adr-002).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#prosemirror-plugins
 */
const BlockGuard = Extension.create({
  name: "blockGuard",
  addProseMirrorPlugins: () => [blockGuard()],
});

/**
 * 커스텀 블록 바로 뒤 Backspace가 블록을 깨지 않게 한다 — editor-core가 "키맵 등록은 editor-react"로 남긴 몫.
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#keyboard-shortcuts
 */
const CustomBlockKeys = Extension.create({
  name: "customBlockKeys",
  priority: CUSTOM_BLOCK_KEYS_PRIORITY,
  addKeyboardShortcuts: () => ({
    Backspace: ({ editor }) =>
      editor.commands.command(({ state, dispatch }) => backspaceAfterCustomBlock(state, dispatch)),
  }),
});

/** 꾸미기 패널의 「움직임 미리 보기」 장식(spec: decoration-panel). 등록만 한다 */
const MotionPreview = Extension.create({
  name: "motionPreview",
  addProseMirrorPlugins: () => [motionPreview()],
});

/** 에디터 한 벌에 싣는 확장 전부 — 스키마 · 분할 · 붙여넣기(editorExtensions)에 가드 · 되돌리기 · 옮기기 · 키맵 · 입력 규칙 · 미리 보기를 더한다. */
export function blogEditorExtensions(): AnyExtension[] {
  return [
    ...editorExtensions,
    BlockGuard,
    History,
    MoveBlock,
    CustomBlockKeys,
    MarkdownShortcuts,
    MotionPreview,
  ];
}
