# Tasks — block-spacing

- [x] 1.1 테스트: 스키마 · 지시어 · 직렬화 · 렌더 · post.css · range-edit 시나리오, 생성기에 space → verify: 빨강(기능 미구현)
- [x] 1.2 테스트: editor-core `setBlockSpace` · DOM 왕복 · 붙여넣기, editor-react 패널 상태 · 선택지 → verify: 빨강
- [x] 1.3 테스트: 실브라우저(Chromium · WebKit) 패널로 간격 바꾸기 → 미리보기 `data-space` → verify: 빨강
- [x] 2.1 content-schema `SPACES` · attrs · 생성기 → verify: schema 단위 초록
- [x] 2.2 content-convert 지시어 · 직렬화 · 형식 가이드 · MCP 설명 → verify: convert 단위 초록
- [x] 2.3 content-render `data-space` · post.css · 계약 사본 → verify: render 단위 초록
- [x] 2.4 editor-core 속성 · DOM · 커맨드 · 붙여넣기, editor-react 패널 · editor.css → verify: editor 단위 · e2e 초록
- [x] 3.1 `pnpm verify` → verify: 초록
- [x] 3.2 테스트: 나누기(Enter 가운데 · 맨 앞 · 스티커) · 붙여넣기로 나누기 · 감싸기(목록 · 번호 목록 · 인용 · 콜아웃, 정렬) · 제목으로 바꾸기 → verify: 빨강 10건
- [x] 3.3 editor-core 나누기 · 붙여넣기는 간격을 앞 조각에만, 감싸기는 간격을 바깥으로 옮기고 정렬을 지우고, 바꾸기는 간격을 옮긴다 → verify: editor 단위 초록
- [x] 3.4 `pnpm verify` → verify: 초록
- [x] 4.1 테스트(리뷰 재현): 목록 빼내기 둘(가운데 빈 항목 Enter · 한 항목 Backspace) · 끝 열린 조각 붙이기 · 래퍼 안 마지막 요소 아래 여백 → verify: 빨강 4건
- [x] 4.2 editor-core 목록 빼내기가 간격을 앞 조각에만 · 통째로 빠지면 잇기, 붙여넣기는 끝 열린 조각의 붙인 블록 간격을 두기, post.css · editor.css 래퍼 안 마지막 요소 여백 · 계약 사본 → verify: 단위 초록
- [x] 4.3 이름 정리(splitBlockKeepingDecoration · DecorationSafeSplit · decorationSafePaste, 옛 이름 별칭 제거) · 간격 버튼 클래스 · "사진 자리를 뺀 모든 최상위 블록" 문구 → verify: `pnpm verify` 초록
