# editor-screen-frame (이슈 #72)

## Why

사용자가 플레이그라운드를 보고 "픽스처 고르기 · 버튼 줄은 왜 있나"라고 물었다(2026-09-24). 개발 확인용 도구가 기본 화면이라 제품처럼 보이지 않는다. 디자인 02 · 03(Figma `68:2` · `69:2`)의 편집 화면 틀을 editor-react 컴포넌트로 만들고, 확인용 도구는 `?dev`일 때만 보인다. M3 web은 이 틀을 가져가 머리줄 동작과 「글 정보」 내용만 채운다.

## What Changes

- editor-react `EditorScreen` — 머리줄(← 글 목록 · 저장 상태 · 미리보기 · 초안 저장 · 발행), 종이(760px), 오른쪽 옆 패널 탭 「글 정보」 | 「꾸미기」
  - 머리줄 동작은 `actions` props. 넘기지 않은 동작은 누를 수 없게 두고 이유(M3에서 연결)를 보인다
  - 「글 정보」 내용은 `postInfo` 슬롯. 없으면 자리 표시 문장
  - 「꾸미기」 탭은 기존 `DecorationPanel`
- 탭 키보드 이동(←/→ · Home · End)은 순수 함수 `tabIndexAfterKey`로
- 스타일은 새 파일 `editor-screen.css`(package export `./editor-screen.css`)
- 플레이그라운드: 기본 화면 = `EditorScreen`. 픽스처 고르기 · 커맨드 버튼 · JSON 보기는 `?dev`일 때 틀 아래에. `?fixture=`는 그대로

## Impact

- editor-react: `EditorScreen.tsx` · `screen-tabs.ts` · `screen-messages.ts` · `editor-screen.css` · `index.ts` · `package.json`(exports 한 줄, 보호 파일)
- 플레이그라운드 3파일
- 새 의존성 없음
- 하지 않는 것: 라우팅 · 저장 · 발행 · 글 정보 폼(M3 web)
