import { useState } from "react";
import { fixtures } from "@blog-editor/content-schema";
import { EditorScreen, useBlogEditor, type StickerId } from "../src";
import { DevTools } from "./DevTools";
import { FIXTURE_NAMES, type FixtureName } from "./fixtures";

/** 스티커 원본은 vite publicDir(content-render assets)가 `/stickers/{id}.png`로 서빙한다 — 에디터 DOM과 같은 주소 */
const stickerSrc = (id: StickerId) => `/stickers/${id}.png`;

const params = new URLSearchParams(window.location.search);

/** `?dev`면 편집 화면 아래에 확인 도구를 붙인다(이슈 #72). 기본 화면은 제품 모양 그대로 */
const DEV = params.has("dev");

/** `?fixture=decorationMax`처럼 주소로 첫 픽스처를 고른다 — 클릭 없는 headless 스크린샷 증거용. 모르는 이름은 무시 */
function initialFixture(): FixtureName {
  const requested = params.get("fixture");
  return FIXTURE_NAMES.find((name) => name === requested) ?? "allBlocks";
}

interface EditorPaneProps {
  fixture: FixtureName;
  onFixtureChange: (fixture: FixtureName) => void;
}

function EditorPane({ fixture, onFixtureChange }: EditorPaneProps) {
  const { editor } = useBlogEditor({ doc: fixtures[fixture].doc, key: fixture, label: "본문" });
  return (
    <>
      <EditorScreen editor={editor} stickerSrc={stickerSrc} />
      {DEV && <DevTools editor={editor} fixture={fixture} onFixtureChange={onFixtureChange} />}
    </>
  );
}

export function Playground() {
  const [fixture, setFixture] = useState<FixtureName>(initialFixture);
  // 픽스처가 바뀌면 에디터를 새로 만든다 — useBlogEditor의 key와 같은 값
  return <EditorPane key={fixture} fixture={fixture} onFixtureChange={setFixture} />;
}
