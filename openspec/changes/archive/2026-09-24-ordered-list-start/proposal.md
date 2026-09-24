# ordered-list-start (이슈 #80)

## Why

번호 목록 가운데 항목을 빼내 목록이 둘로 갈리면 뒤 조각이 1부터 다시 센다(PR #79 리뷰). 문서 스키마에 번호 목록 시작 번호 자리가 없어서다. markdown 가져오기도 `3.`으로 시작하는 목록을 "정보를 잃는 변형"으로 거부해 왔다.

## What Changes

- content-schema: `orderedList.attrs.start`(정수 1 이상, CommonMark 상한 9자리) — 최상위와 안쪽 번호 목록 모두. 시작 번호는 꾸미기가 아니라 구조라서 안쪽 목록에도 자리가 있다
- normalize: `start: 1`은 지운다(기본 모양, 저장 형식 하나)
- content-render: `<ol start="n">`
- content-convert: `3.`으로 시작하는 목록 → `start: 3`, 직렬화는 첫 표지를 시작 번호로. `0.`은 거부한다
- editor-core: `ol[start]`를 검증해 읽고 쓴다. 최상위 번호 목록에서 항목을 빼내 목록이 갈리면 뒤 조각이 번호를 잇는다

## Impact

- schemaVersion은 1 그대로 — 선택 속성 추가라 기존 문서는 모두 유효하다. 읽는 쪽은 이 레포뿐이고 사이트는 렌더된 HTML만 받는다
- 공개 API HTML에 `ol[start]`가 나온다 — 사이트 sanitizer 허용 목록에 `start`(숫자) 추가가 필요하다(사이트 레포, 이 change 밖)
- 하지 않는 것: 사용자가 시작 번호를 직접 고치는 UI · 안쪽 목록 Shift-Tab(뒤 항목은 빠져나온 항목의 안쪽 목록이 되므로 1부터가 맞다) · 떨어진 두 번호 목록을 하나로 합치기
