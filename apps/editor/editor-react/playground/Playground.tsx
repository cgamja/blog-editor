import { useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import { fixtures } from "@blog-editor/content-schema";
import {
  insertAppScreenshot,
  insertCallout,
  moveBlockDown,
  moveBlockUp,
  setCalloutTone,
} from "@blog-editor/editor-core";
import { BlogEditor, DecorationPanel, WidthToolbar, readDoc, useBlogEditor } from "../src";

type FixtureName = keyof typeof fixtures;
const FIXTURE_NAMES = Object.keys(fixtures) as FixtureName[];

// 스크린샷 넣기 버튼이 쓰는 저장 경로 모양의 예시 — 실제 파일은 없다(이미지 업로드는 M5)
const SAMPLE_SCREENSHOT = { src: "/images/playground-sample.webp", caption: "플레이그라운드 예시" };

type DocView = { ok: true; text: string } | { ok: false; text: string };

/** 저장 가능한 문서면 JSON, 아니면 zod 오류 문장 */
function describeDoc(read: () => unknown): DocView {
  try {
    return { ok: true, text: JSON.stringify(read(), null, 2) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, text: `저장할 수 없는 문서: ${reason}` };
  }
}

function EditorPane({ fixture }: { fixture: FixtureName }) {
  const { editor } = useBlogEditor({ doc: fixtures[fixture].doc, key: fixture, label: "본문" });
  const view = useEditorState({
    editor,
    selector: ({ editor: current }) => describeDoc(() => readDoc(current.state.doc)),
  });

  const run = (command: Command) => () => {
    editor
      .chain()
      .focus()
      .command(({ state, dispatch }) => command(state, dispatch))
      .run();
  };

  return (
    <div className="playground">
      <section aria-label="에디터">
        <div className="playground-toolbar" role="toolbar" aria-label="커맨드">
          <button type="button" onClick={run(insertCallout("note"))}>
            콜아웃 넣기
          </button>
          <button type="button" onClick={run(setCalloutTone("tip"))}>
            tone → tip
          </button>
          <button type="button" onClick={run(setCalloutTone("warning"))}>
            tone → warning
          </button>
          <button type="button" onClick={run(insertAppScreenshot(SAMPLE_SCREENSHOT))}>
            스크린샷 넣기
          </button>
          <button type="button" onClick={run(moveBlockUp)}>
            블록 위로
          </button>
          <button type="button" onClick={run(moveBlockDown)}>
            블록 아래로
          </button>
          {/* TODO(#45): 인용으로 감싸기 — 감싸기 커맨드가 editor-core에 생기면 버튼을 단다 */}
        </div>
        <div className="playground-page">
          <BlogEditor editor={editor} />
          <WidthToolbar editor={editor} />
        </div>
        <details className="playground-doc">
          <summary>현재 문서(JSON)</summary>
          <pre className={view.ok ? "playground-json" : "playground-json playground-error"}>
            {view.text}
          </pre>
        </details>
      </section>
      {/* 스티커 그림 파일은 #58이 레포에 둔다 — 머지되면 stickerSrc를 잇는다 */}
      <DecorationPanel editor={editor} />
    </div>
  );
}

/** `?fixture=decorationMax`처럼 주소로 첫 픽스처를 고른다 — 클릭 없는 headless 스크린샷 증거용. 모르는 이름은 무시 */
function initialFixture(): FixtureName {
  const requested = new URLSearchParams(window.location.search).get("fixture");
  return FIXTURE_NAMES.find((name) => name === requested) ?? "allBlocks";
}

export function Playground() {
  const [fixture, setFixture] = useState<FixtureName>(initialFixture);

  return (
    <main>
      <label>
        픽스처{" "}
        <select value={fixture} onChange={(event) => setFixture(event.target.value as FixtureName)}>
          {FIXTURE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {/* 픽스처가 바뀌면 에디터를 새로 만든다 — useBlogEditor의 key와 같은 값 */}
      <EditorPane key={fixture} fixture={fixture} />
    </main>
  );
}
