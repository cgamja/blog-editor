# ADR-017. 에디터 스키마는 공식 `@tiptap/extension-*` 없이 `Node.create` · `Mark.create`로 닫힌 집합을 직접 정의한다

- 날짜: 2026-09-24
- 상태: 승인됨
- 원천: 이슈 #37 · editor-core-schema change(design.md) · adr-002(TipTap v3) · adr-003(문서 JSON이 원천) · adr-008(꾸미기 닫힌 집합)
- 대체: adr-002의 "노드 · 마크 확장 개별 설치(`@tiptap/extension-*`)" 한 구절만. TipTap v3 · `@tiptap/pm` 하나 · ProseMirror 순수 함수라는 결정은 그대로다.

## 문제 (맥락)

에디터가 만들 수 있는 문서는 content-schema(zod)가 정한 닫힌 집합과 **같아야** 한다. 에디터에서 만든 문서가 저장에서 거부되거나 저장된 문서가 에디터를 지나며 바뀌면 안 된다. 그런데 TipTap 공식 확장은 우리 집합 밖의 것을 함께 들고 온다.

- link: `target` · `rel` · `class` attrs와 자동 링크화
- heading: 1~6 수준(우리는 2 · 3만)
- image: `title` · `width` · `height`(우리 `width`는 꾸미기 %라서 뜻이 다르다)
- 공통: `parseHTML`과 입력 규칙이 붙여넣기 · 타이핑으로 집합 밖 모양을 만든다

## 결정

- 노드 10종 + `listItem` · `text`와 마크 4종을 `@tiptap/core`의 `Node.create` · `Mark.create`로 직접 정의하고 `getSchema`로 ProseMirror 스키마를 만든다(`apps/editor/editor-core/src/extensions.ts`).
- 의존성은 `@tiptap/core` · `@tiptap/pm` 둘뿐이다. 둘 다 **3.31.3으로 정확히 고정**하고(`^` 없음) `dependencies`에 둔다.
- 경계 함수 `docToNode` · `docFromNode`가 zod를 먼저 지난다. ProseMirror는 모르는 attrs를 조용히 버리고 값을 검사하지 않기 때문이다(design.md 3).

### LIBRARY 2단계 검진 (`@tiptap/core` · `@tiptap/pm` 3.31.3)

| 항목        | 결과                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용 규모   | `@tiptap/core` 주간 약 1,349만 다운로드(npm, 2026-09-15~21)                                                                                                                                                                                                                                           |
| 유지 상태   | 3.x가 활발히 나온다(3.31.0 → 3.31.3이 2026-09-01~04). 저장소 github.com/ueberdosis/tiptap                                                                                                                                                                                                             |
| 라이선스    | MIT(둘 다)                                                                                                                                                                                                                                                                                            |
| 타입        | 패키지에 `.d.ts` 포함(`@types` 불필요)                                                                                                                                                                                                                                                                |
| 모듈 형식   | ESM(`type: module`) + CJS 이중 배포                                                                                                                                                                                                                                                                   |
| 번들 · 크기 | `@tiptap/core` unpacked 약 2.9MB(소스맵 포함), `@tiptap/pm`은 재수출만 한다(약 15KB). 실제 크기는 editor-react · web 번들에서 잰다(M3)                                                                                                                                                                |
| 전이 의존성 | lockfile에 새로 들어온 14개: prosemirror-changeset · commands · dropcursor · gapcursor · history · inputrules · keymap · schema-list · state · tables · transform · view, rope-sequence, w3c-keyname. `prosemirror-model` 1.25.12 · `orderedmap`은 content-convert가 이미 들였고 **한 벌을 공유**한다 |
| 대안        | 버린 대안 절 참고                                                                                                                                                                                                                                                                                     |
| 보안        | pnpm audit --prod 알려진 취약점 없음(2026-09-24) · 정확 고정이라 패치는 사람이 올린다                                                                                                                                                                                                                 |

- **정확히 고정한 이유**: 에디터는 라이브러리 · 브라우저 갱신만으로 한글 조합(IME)이 깨진 전례가 있다(adr-002 트레이드오프, ProseMirror #1484). 버전을 올릴 때는 한글 수동 체크리스트와 함께 사람이 올린다.
- **peerDependencies가 아니라 dependencies에 둔 이유**: editor-core는 배포하지 않는 내부 패키지다(adr-001). 버전을 정하는 주체가 editor-core 자신이고, 설치하는 쪽이 따로 없다.
- **prosemirror-model이 두 벌 될 위험**: ProseMirror는 `Schema` · `Node`를 `instanceof`로 확인한다. 모델 패키지가 두 벌 깔리면 "다른 스키마의 노드"로 실패한다. editor-react가 `@tiptap/react`를 들일 때 같은 3.31.3으로 고정하고, 설치 뒤 lockfile에 `prosemirror-model`이 한 벌뿐인지 확인한다(`pnpm why prosemirror-model`). 갈라지면 `pnpm.overrides`로 맞추고 그 사실을 적는다. content-convert의 `prosemirror-model ^1.25.12`와 `@tiptap/pm`의 `^1.25.11`은 지금 1.25.12 하나로 풀린다.

## 버린 대안

- **공식 확장을 그대로 개별 설치(adr-002 원래 문구)**: 집합 밖 attrs(link `target`/`rel`/`class`, heading 1~6, image `title`)가 스키마에 들어온다. `docFromNode`에서 zod가 매번 거부하거나, 거부를 피하려고 경계에서 조용히 지우게 된다. 어느 쪽이든 원천이 둘이 된다.
- **공식 확장을 `.extend({ addAttributes })`로 덮어쓰기**: attrs는 바꿀 수 있지만 `parseHTML` · `addInputRules` · `addPasteRules` · 커맨드는 그대로 남는다. 붙여넣기와 타이핑이 집합 밖 모양을 계속 만들고, 무엇을 덮었는지 확장마다 추적해야 한다. 공식 확장이 업그레이드되면 덮어쓴 부분이 조용히 어긋난다.
- **`configure({ levels: [2, 3] })` 같은 옵션으로 제한하기**: 옵션이 있는 곳(heading 수준)만 막히고, 옵션이 없는 attrs(link `rel` 등)와 입력 규칙은 남는다. 확장마다 막을 수 있는 범위가 달라 닫힌 집합을 보장하지 못한다.

## 감수한 트레이드오프

- 공식 확장이 공짜로 주던 입력 규칙(`## ` → 제목, `- ` → 목록), 단축키(Mod-B 등), 붙여넣기 처리, `renderHTML` · `parseHTML`을 **우리가 직접 짠다**. M2 후속 이슈(blockGuard · pasteNormalizer · 입력 규칙 · 블록 옮기기)의 작업량이 그만큼 늘어난다.
- 공식 확장의 버그 수정 · 접근성 개선을 자동으로 받지 못한다.
- 정확한 버전 고정이라 보안 패치도 사람이 올려야 한다(`pnpm audit` · Dependabot 알림으로 받는다).
- adr-013이 약속한 "content-convert PM 스키마도 같은 속성 테스트 대상"은 미뤘다 — convert의 `pmSchema`는 문서와 같은 집합이 아닌 markdown 파서 중간 스키마라 같은 왕복이 성립하지 않는다. `convertMarkdown` 결과가 editor 스키마를 왕복하는 테스트로 [#38](https://github.com/cgamja/blog-editor/issues/38)에서 이행한다.

## 재검토 조건

- M2에서 입력 규칙 · 단축키가 필요할 때. 공식 확장의 해당 부분만 떼어 쓸 수 있는지(예: `@tiptap/core`의 `markInputRule` · `textblockTypeInputRule` 헬퍼) 먼저 본다.
- TipTap이 확장의 attrs · parseHTML을 선택적으로 끌 수 있는 공식 방법을 내놓을 때.
- editor-react 단계에서 `@tiptap/react`가 다른 `@tiptap/pm` 버전을 요구해 모델이 두 벌 될 때.
