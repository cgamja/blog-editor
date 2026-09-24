import { useEditorState, type Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import {
  insertAppScreenshot,
  insertCallout,
  moveBlockDown,
  moveBlockUp,
  setCalloutTone,
} from "@blog-editor/editor-core";
import { readDoc, useCommandRunner } from "../src";
import type { FixtureName } from "./fixtures";
import { FIXTURE_NAMES } from "./fixtures";
import { devMessages } from "./messages";

// 스크린샷 넣기 버튼이 쓰는 저장 경로 모양의 예시 — 실제 파일은 없다(이미지 업로드는 M5)
const SAMPLE_SCREENSHOT = {
  src: "/images/playground-sample.webp",
  caption: devMessages.sampleCaption,
};

type DocView = { ok: true; text: string } | { ok: false; text: string };

/** 저장 가능한 문서면 JSON, 아니면 zod 오류 문장 */
function describeDoc(read: () => unknown): DocView {
  try {
    return { ok: true, text: JSON.stringify(read(), null, 2) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, text: devMessages.cannotSave(reason) };
  }
}

interface DevToolsProps {
  editor: Editor;
  fixture: FixtureName;
  onFixtureChange: (fixture: FixtureName) => void;
}

/** `?dev`일 때만 편집 화면 아래에 붙는 확인 도구(이슈 #72) — 픽스처 고르기 · 커맨드 버튼 · 저장 형식 JSON */
export function DevTools({ editor, fixture, onFixtureChange }: DevToolsProps) {
  const view = useEditorState({
    editor,
    selector: ({ editor: current }) => describeDoc(() => readDoc(current.state.doc)),
  });
  const runCommand = useCommandRunner(editor);
  const run = (command: Command) => () => runCommand(command);

  return (
    <section className="playground-dev" aria-label={devMessages.sectionLabel}>
      <label>
        {devMessages.fixture}{" "}
        <select
          value={fixture}
          onChange={(event) => onFixtureChange(event.target.value as FixtureName)}
        >
          {FIXTURE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="playground-toolbar" role="toolbar" aria-label={devMessages.toolbarLabel}>
        <button type="button" onClick={run(insertCallout("note"))}>
          {devMessages.insertCallout}
        </button>
        <button type="button" onClick={run(setCalloutTone("tip"))}>
          {devMessages.toneTip}
        </button>
        <button type="button" onClick={run(setCalloutTone("warning"))}>
          {devMessages.toneWarning}
        </button>
        <button type="button" onClick={run(insertAppScreenshot(SAMPLE_SCREENSHOT))}>
          {devMessages.insertScreenshot}
        </button>
        <button type="button" onClick={run(moveBlockUp)}>
          {devMessages.moveUp}
        </button>
        <button type="button" onClick={run(moveBlockDown)}>
          {devMessages.moveDown}
        </button>
      </div>
      <details className="playground-doc">
        <summary>{devMessages.docSummary}</summary>
        <pre className={view.ok ? "playground-json" : "playground-json playground-error"}>
          {view.text}
        </pre>
      </details>
    </section>
  );
}
