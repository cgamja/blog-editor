# photo-placeholder (이슈 #136)

## Why

AI는 이미지를 올릴 길이 없다. 사용자 결정(2026-09-25)은 "칸을 비워 두고 이런 사진을 넣어 달라고 써 두기"이고, 적어 둔 설명은 AI 이미지 생성(adr-029 · #155)의 주문서가 된다. 사용자는 또 "어떤 사진이 만들어지는지 에디터에서 alt처럼 보고, 사진을 고칠 때 참고"하길 원한다 — 설명은 사진이 들어간 뒤에도 남아야 하고, 공개 글에는 나가지 않아야 한다.

## What Changes

- content-schema
  - 최상위 블록 `photoPlaceholder`(`brief` 설명 · `ratio` 원하는 비율)를 더한다. 꾸밈 자리는 없다.
  - 그림(`image`)에 에디터 전용 칸 `brief`를 더한다. alt(공개 · 검색 · 접근성)와 따로다.
  - `publicDocOf(doc)` — 사진 자리와 그림 설명을 뺀 공개용 문서.
  - SEO 점검에 `photo-placeholder`(must) — 사진 자리가 남으면 발행 확인 · MCP 저장 응답이 알린다(막지 않는다, adr-030).
- content-convert
  - `:::photo ratio=4:3` 컨테이너 안 설명 한 문단을 사진 자리로 읽고 쓴다. 형식 가이드에 넣는다.
  - 그림 설명은 markdown에 자리가 없어 `losses`의 `imageBrief`로 알린다.
  - 부분 고치기(adr-031)는 사진 자리의 설명을 그 블록의 글로 찾는다. 설명 글자만 바꾸지는 않고 블록째 바꾼다.
  - 외부 이미지 주소 거부 메시지의 고치는 법을 "사진 자리로 바꾼다"로 바꾼다(AI가 사진 자리를 남기게).
- content-render: 사진 자리는 아무것도 그리지 않고, 그림 설명은 HTML에 없다.
- api: 공개 조회(`GET /public/posts`)는 렌더 전에 `publicDocOf`를 거친다(두 번째 방어).
- editor-core
  - `photoPlaceholder` 노드(점선 상자에 설명), 그림 `brief` 속성.
  - 사진 자리에 파일을 놓거나 「사진 올리기」로 고르면 올린 그림이 그 자리를 채운다 — 설명은 alt 기본값과 그림 `brief`로 옮겨진다.
  - `setBrief` · `imageToPlaceholder`(그림 → 설명을 지닌 사진 자리, 사진 바꾸기) 커맨드.
- editor-react: 사진 자리를 고르면 「사진 올리기」 · 「사진 설명」, 그림을 고르면 폭 도구줄에 「사진 설명」(보기 · 고치기 · 사진 자리로 되돌리기).
- ADR-033.

## Impact

- 새 의존성은 없다. schemaVersion도 1 그대로다(추가뿐, adr-020 선례).
- 공개 계약 사본 · openapi.json을 다시 만든다(문서 스키마가 바뀐다).
- 하지 않는 것: 사진 자리의 꾸밈(폭 · 정렬 · 움직임 · 스티커), 그림 설명의 markdown 문법, `/` 메뉴의 사진 자리 넣기, AI 이미지 생성 자체(#155).
