# sticker-markdown (이슈 #134)

## Why

글꼴 · 움직임 · 정렬(`{font= motion= align=}`)과 글자 스타일(`[글]{color= size=}`)은 이미 markdown으로 오간다. 스티커만 markdown 자리가 없어서 `get_post`가 `losses: stickers`로 알린다. 그래서 AI가 글 전체 markdown으로 `update_draft`하면 스티커가 사라지고, AI가 초안을 쓸 때 스티커를 붙일 수도 없다. 사용자 방향(2026-09-25, M7)은 "AI가 쓰고 꾸미고 고치는 게 기본"이고, 스티커는 노션과의 차별점이다.

## What Changes

- 블록 지시어에 되풀이할 수 있는 키 `sticker=<종류>@<x>,<y>,<크기>[,<회전>]`를 더한다. 예: `{font=jua sticker=heart@90,10,12,15 sticker=star-mint@-5,40,8}`.
  - 값은 adr-008 그대로다. 좌표 · 크기는 블록 기준 %이고, 회전은 도(degree)다. 회전을 빼면 0이다.
  - 종류와 범위는 닫힌 집합(`STICKER_IDS` · `STICKER_RANGES`)으로 검사하고, 틀리면 고칠 방법 메시지를 낸다. 문서 전체가 `MAX_STICKERS_PER_DOC`(12)를 넘으면 문서 메시지를 낸다.
  - 모든 최상위 블록에 쓸 수 있다(decoration-schema에서 스티커 자리가 모든 최상위 블록에 있다).
- 직렬화는 스티커를 지시어 줄 끝에 `sticker=` 키로 쓴다. 블록 안 순서 그대로 쓰고, 회전은 늘 적는다. 그래서 `losses`에 `stickers`가 더는 나오지 않는다. 예외는 빈 문단처럼 블록째 빠지는 경우다 — 그 블록의 스티커는 그대로 `stickers`로 센다.
- 형식 가이드(`get_writing_guide`)에 스티커 문법 · 종류 목록 · 좌표의 뜻을 적는다.
- 부분 고치기(adr-031)의 스티커 옮기기는 그대로 둔다. 새 markdown이 `sticker=`를 쓰면 그것을 쓰고, 안 쓰면 옛 스티커를 옮긴다.

## Impact

- content-convert: `directives.ts`(키 허용 · 값 검사) · 새 `sticker-directive.ts`(값 읽기 · 쓰기) · `sticker-directive.messages.ts` · `parser.ts` · `serialize.ts` · `guide/format.md`
- 스키마 · 렌더 · 에디터 · 공개 API는 바뀌지 않는다. schemaVersion은 그대로다.
- MCP 도구는 6개 그대로다.
- ADR-032.
