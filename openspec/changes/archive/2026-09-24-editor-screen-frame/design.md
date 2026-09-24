# design — editor-screen-frame

## 1. 틀과 슬롯

`EditorScreen({ editor, status, actions, postInfo, stickerSrc })`. 화면(web)이 알아야 할 것만 props로 받는다.

- `actions`: `onBack` · `onPreview` · `onSaveDraft` · `onPublish` — 빠진 동작은 `aria-disabled` 버튼(포커스는 받고 누르면 아무 일 없음)과 이유 문장(`aria-describedby`)으로 둔다. `disabled` 속성은 포커스를 잃어 키보드 사용자가 이유를 읽을 수 없어서 쓰지 않는다.
- `status`: 저장 상태 문장. 없으면 비운다.
- `postInfo`: 「글 정보」 탭 내용. 없으면 "M3에서 채운다"는 자리 표시.

## 2. 탭

WAI-ARIA APG Tabs 패턴(https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — 자동 활성화, 로빙 tabindex, ←/→는 끝에서 처음으로 돈다, Home/End. 키 → 다음 탭 번호 계산은 DOM 없는 `tabIndexAfterKey(current, key, count)`로 떼어 Vitest node에서 확인한다. 모르는 키는 null(기본 동작 유지).

`DecorationPanel`은 자기 `<aside aria-label="꾸미기">`를 그대로 갖는다. 옆 패널 자체는 `<div>`라서 aside가 겹치지 않는다.

## 3. 배치

- 화면 = 2행(머리줄 68px · 나머지) × 2열(본문 · 옆 패널 320px), 높이 100dvh. 본문과 옆 패널이 각자 스크롤한다.
- 종이: 760px, 안쪽 여백 64px 80px, 그림자는 디자인 `68:2` 값(토큰 없음 — 주석으로 출처). 블록 손잡이(−104px)는 종이 밖으로 나간다(디자인과 같다).
- 1100px 미만이면 옆 패널이 본문 아래로 내려가고 화면 전체가 스크롤한다(768 확인 기준: 깨지지만 않게, design/map.md).

## 4. 플레이그라운드

`?dev`가 있으면 틀 아래에 확인 도구(픽스처 고르기 · 커맨드 버튼 · JSON)를 둔다. 픽스처를 바꾸면 에디터를 새로 만든다(useBlogEditor key). 기본 픽스처는 지금처럼 `allBlocks`(블록 종류가 가장 많아 화면을 보기 좋다).
