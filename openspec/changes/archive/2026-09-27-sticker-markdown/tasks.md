# Tasks — sticker-markdown

- [x] 1.1 테스트: 지시어 `sticker=`가 블록 스티커가 된다 · 되풀이 · 회전 생략 · 이미지 · 표 → verify: 빨강
- [x] 1.2 테스트: 종류 · 모양 · 범위 오류와 문서 합계 12 초과 메시지 → verify: 빨강
- [x] 1.3 테스트: 직렬화가 스티커를 지시어로 쓰고 losses에 stickers가 없다 · 빈 문단 블록의 스티커는 losses · 속성 왕복에 스티커 포함 → verify: 빨강
- [x] 2.1 `sticker-directive.ts` · `directives.ts` · `parser.ts` · `serialize.ts` → verify: 1.x 초록
- [x] 2.2 형식 가이드 · ADR-032 → verify: 가이드 example 블록 형식 검사 초록
- [x] 3.1 `pnpm verify` → verify: 초록
- [x] 3.2 리뷰 수정: 값 안 공백은 지시어 값 오류 · 스티커 블록 여럿 → sticker= 없는 블록은 실패(베낄 sticker= 글 · 버리는 법) · 문서 문구(sticker=는 대신한다 · 가운데 자리) · 메시지 message.ts로 → verify: 단위 초록
- [x] 4.1 archive 때 markdown-directive Purpose의 "스티커는 markdown 문법이 없다" 고치기 → verify: 사람(main)
