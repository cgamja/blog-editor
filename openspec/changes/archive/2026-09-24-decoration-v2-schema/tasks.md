## 1. 스키마

- [x] 1.1 content-schema: textStyle · strike · underline 마크, align, 스티커 size 하한 2, 픽스처 · 생성기

## 2. 렌더

- [x] 2.1 content-render: 마크 태그 · data 속성 · hex CSS 변수(재검사) · 래퍼 data-align
- [x] 2.2 post.css: 글자 스타일 · 정렬 · 취소선 · 밑줄 규칙

## 3. markdown

- [x] 3.1 content-convert 읽기: 괄호 span 인라인 규칙 · 취소선 허용 · align 지시어 · 값 검사 메시지
- [x] 3.2 content-convert 쓰기: 새 마크 · align 직렬화, 왕복 속성 테스트
- [x] 3.3 형식 가이드(format.md) 갱신 — 예시는 전부 유효

## 4. 에디터

- [x] 4.1 editor-core: 마크 3개 · align attrs 등록(parseDOM/toDOM = 렌더 어휘, 값 검증)

## 5. 마무리

- [x] 5.1 verify · archive
