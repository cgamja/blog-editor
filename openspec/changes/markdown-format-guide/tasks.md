# Tasks — markdown-format-guide (이슈 #7)

문서만 만드는 change다 — 코드 task 없음. 변환기 구현은 content-convert 이슈의 몫이고, 이 스펙의 시나리오가 그 테스트 원천이 된다. 원천 코드: `packages/content-schema/src/doc.ts`(닫힌 집합 상수 · 노드 내용 규칙). 문법 결정(컨테이너 vs 펜스 · 지시어 위치 · 스크린샷 프레임)은 스펙 본문에 적고 여기서는 산출물만 센다.

## 1. 스펙

- [x] 1.1 `specs/markdown-format/spec.md` — 표준 대응표 · `:::callout` 컨테이너 · `{key=value}` 지시어 · `{frame=app}` · 스티커 문법 없음 · 가이드 예시 유효성 → verify: `pnpm exec openspec validate markdown-format-guide --strict`
- [x] 1.2 `specs/markdown-validation-message/spec.md` — 세 칸 형식 · 전부 모아서 · 통과 시 빈 배열 → verify: 1.1과 같은 명령

## 2. 형식 가이드 문서 (AI가 읽는다 — 예시 위주, 문법당 예시 하나)

- [x] 2.1 `packages/content-convert/guide/format.md` 앞부분 — 이해 체크포인트 한 단락(markdown이 입력 전용인 이유, adr-003) · 표준 문법 대응표(되는 것 / 안 되는 것) → verify: `pnpm exec prettier --check packages/content-convert`
- [x] 2.2 같은 파일 확장 문법 절 — 콜아웃 · 속성 지시어 · 앱 스크린샷 · 스티커 없음 · 스파이크 #2 유보 한 줄 → verify: 예시 코드 블록이 스펙 시나리오의 입력과 일치
- [x] 2.3 같은 파일 검증 실패 메시지 절 — 세 칸 형식 + 예시 3개 → verify: markdown-validation-message 시나리오의 메시지 모양과 일치

## 3. Converge

- [x] 3.1 스펙 `#### Scenario` 10개 ↔ 가이드 절 대조 — 시나리오의 입력 문법이 가이드 예시에 전부 있는지, 가이드에만 있는 문법이 없는지 → verify: `pnpm verify` 초록(docs:check 포함)
