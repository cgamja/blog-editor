# editor-seo-panel (이슈 #151)

## Why

검색 노출 점검(adr-030 · adr-034)은 지금 발행 확인을 열어야만 보인다. 글을 쓰는 동안에는 점수가 어떻게 움직이는지, 어느 블록이 걸리는지 알 수 없어 발행 직전에 한꺼번에 고치게 된다.

## 디자인 결정

디자인 캔버스 https://claude.ai/artifact/CNLD2RJ3BSjcTQ2KPpkFPP 의 후보 중 **C · 머리줄 점수 칩 + 본문 여백 점**(사용자 결정).

- 머리줄: 「검색 노출 <점수>」 칩 + 꼭 고치기 개수 pill. 누르면 팝오버(이름 "검색 노출 점검", 340px 흰 카드 · 그림자) 안에 등급 pill · 문구 · 「→ 위치」 목록과 "발행은 막지 않아요."
- 본문: 블록을 가리키는 발견마다 그 최상위 블록 옆 **오른쪽** 여백(블록 오른쪽 가장자리 너머, 종이 안)에 28px 원형 점(이름 "<등급>: <문구>", 누르는 자리 44px). 점에 올리거나 포커스하면 대상 블록을 postit 색으로 옅게 칠한다.
- 점을 목업의 왼쪽에서 오른쪽으로 옮긴 이유(#151 리뷰): 왼쪽 여백은 블록 손잡이 줄(블록 왼쪽 −104px)이 쓰고 있어, 손잡이보다 더 왼쪽에 두면 1280에서 점이 종이 밖(회색 바탕)으로 나가고 768에서는 종이 여백이 모자라 화면 안으로 당기면 손잡이를 가렸다. 오른쪽 여백(80px)은 비어 있어 점 하나가 종이 안에 들어가고, 점이 여럿이면 아래로 접힌다.

## What Changes

- web: `useSeoLive`가 문서 · 제목 · 설명 · 핵심 검색어가 바뀌면 입력이 멈춘 뒤(`SEO_LIVE_DELAY_MS`) 발행 확인과 같은 `seoCheckOf`(`checkSeo` · `scoreSeo`)로 다시 매긴다. 한글 조합 중에는 미룬다(`isEditorComposing`, use-autosave 선례).
- web: 발행 확인의 `seoCheckOf`를 `seo-check.ts`로 옮겨 칩과 발행 확인이 같은 함수를 쓴다. 다른 글 목록을 읽는 중 · 실패면 칩은 점수 대신 까닭을 보인다(#166 규칙과 같다).
- web: `SeoChip`(칩 + 비모달 팝오버, Esc · 바깥 클릭 닫기, aria-expanded), 항목을 누르면 블록은 본문 편집기의 그 블록 안으로, 메타는 해당 입력 칸(제목 · 설명 · 핵심 검색어 — 가려진 「글 정보」 탭은 먼저 연다)으로 포커스.
- editor-react: `EditorScreen`에 머리줄 도구 자리(`headerTools`)와 본문 여백 점(`blockFlags` — 점 목록과 누를 때 할 일 한 묶음, 틀은 본문에 그대로 넘긴다)을 더한다. 점은 뜻을 모르는 일반 표식(`BlockFlag` — 블록 번호 · 이름 · 세기, 인라인 마크와 이름이 겹치지 않게 flag)이고 자리는 블록 손잡이와 같은 `measureBlocks`로 잰다. 블록으로 옮기는 `focusEditorBlock`을 연다.
- editor-core: `selectBlock(index)` 커맨드 — 그림 · 구분선처럼 atom인 블록은 노드 선택, 글 블록은 그 안 첫 커서 자리. `focusEditorBlock`은 이 커맨드 + 스크롤 + 포커스만 한다.
- web: 문서가 바뀐 뒤 다시 매기기 전에는 블록 번호가 어긋날 수 있어 여백 점을 비우고 팝오버의 블록 항목을 막는다. 점검은 스냅샷 · 다른 글 목록이 바뀔 때만 다시 매긴다(`useMemo`).
- 640px 미만에서 칩은 「검색 노출」 글자를 숨기고 점수만(이름은 유지), 여백 점은 블록 손잡이처럼 숨긴다.

## 하지 않은 것

- 발행 확인 `SeoChecklist`는 그대로 둔다(등급 pill 클래스만 같이 쓴다).
- 점 위 말풍선(이름은 `title` · 접근성 이름으로만).
- 점검 규칙 · 점수 식은 바꾸지 않는다(content-schema 그대로).

## Impact

- web: `components/LoadedPostEditor.tsx` · `EditorDialogs.tsx` · `SeoChip.tsx` · `SeoFindingButtons.tsx` · `TitleField.tsx` · `PostInfoPanel.tsx` · `hooks/use-seo-live.ts` · `use-seo-jump.ts` · `use-popover.ts` · `seo-check.ts` · `constants.ts` · `messages.ts` · `types.ts` · `editor-page.css`
- editor-react: `EditorScreen.tsx` · `ScreenHeader.tsx` · `BlogEditor.tsx` · `BlockFlagLayer.tsx` · `block-flag-*.ts` · `use-block-flag-rows.ts` · `block-geometry.ts` · `editor-bridge.ts` · `index.ts` · `editor.css` · `editor-screen.css`
- editor-core: `commands/select-block.ts` · `index.ts`
- 스키마 · API · 렌더는 바뀌지 않는다.
