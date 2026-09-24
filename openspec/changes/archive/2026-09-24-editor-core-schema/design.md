# Design — editor-core-schema

## 1. 의존성 (adr-002 · adr-017)

| 패키지         | 버전                 | 근거                                                                                                                 |
| -------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@tiptap/core` | 3.31.3 (정확히 고정) | adr-002 "TipTap v3". npm 최신 3.x, 2026-09-04 공개 — pnpm 최소 공개 기간(1440분) 통과. MIT. peer `@tiptap/pm` 3.31.3 |
| `@tiptap/pm`   | 3.31.3               | adr-002 "ProseMirror는 `@tiptap/pm`이 다시 내보내는 것만" — prosemirror-model ^1.25.11 등                            |

- 정확한 버전 고정(`^` 없음): 에디터는 조합(IME) 회귀가 브라우저 · 라이브러리 갱신으로 생긴다(adr-002 트레이드오프, ProseMirror #1484). 올릴 때는 한글 수동 체크리스트와 함께 올린다.
- 공식 `@tiptap/extension-*`는 쓰지 않고 `Node.create` · `Mark.create`로 직접 정의한다 — 이유 · 버린 대안 · LIBRARY 검진은 adr-017(adr-002의 개별 설치 구절을 일부 대체).
- `pnpm audit --prod`: 알려진 취약점 없음.

## 2. 스키마 모양

근거: TipTap `getSchema` — https://tiptap.dev/docs/editor/core-concepts/schema · `Node.create`/`addAttributes` — https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node · ProseMirror content expression — https://prosemirror.net/docs/guide/#schema.content_expressions · 설치된 `@tiptap/core` 3.31.3 `buildAttributeSpec`(`isRequired`면 default를 두지 않는다).

- `doc`: `content: "block+"`. 최상위 블록 10종은 `group: "block"`.
- 목록: `bulletList` · `orderedList`는 `listItem+`, `listItem`은 `paragraph (bulletList | orderedList)*` — content-schema의 `z.tuple([innerParagraph], innerList)`와 같다.
- `blockquote`: `paragraph+`. `callout`: `(paragraph | bulletList | orderedList)+`.
- `paragraph` · `heading`: `text*`(마크 전부). `codeBlock`: `text*`, `marks: ""`.
- `horizontalRule` · `image` · `appScreenshot`: 잎(atom) 노드.
- 마크 정의 순서는 `bold` · `code` · `italic` · `link` — ProseMirror는 스키마 순서(rank)로 마크를 정렬하는데, 정규형(content-schema normalize)은 type 사전순이다. 같게 두어 `toJSON`이 이미 정규형 순서로 나온다.
- 필수 attrs(`heading.level` · `callout.tone` · `image.src/alt` · `appScreenshot.src/caption` · `link.href`)는 TipTap `isRequired: true`(default를 두지 않는다). 다만 ProseMirror는 **`attrs` 객체 자체가 없으면** 필수 attrs도 `null`로 채운다(`NodeType.create(attrs = null)` → `computeAttrs`가 `null && …`로 `null`을 값으로 받는다 — 설치된 prosemirror-model 1.25.12에서 확인). 그래서 필수 attrs 누락은 zod 층이 막는 것으로 스펙에 적는다. `isRequired`는 attrs 객체가 있는데 키가 빠진 경우(에디터 커맨드가 만들 수 있는 모양)를 ProseMirror에서도 막으려고 둔다. 나머지 attrs는 `default: null`.

### 안쪽 노드와 최상위 노드 (content-schema 4장)

ProseMirror에서 노드 이름은 스키마에 하나뿐이다 — 최상위 `paragraph`(꾸미기 attrs 있음)와 인용 · 목록 안 `paragraph`(꾸미기 자리 없음)는 **같은 `paragraph` 타입**이다. 둘을 다른 타입(예: `innerParagraph`)으로 나누면 JSON의 `type`이 달라져 저장 형식과 어긋난다. 그래서:

- 스키마는 한 타입에 꾸미기 attrs를 두고(기본 `null`), `docFromNode`가 `null`을 지운다 → 안쪽 노드는 attrs 없이 나온다.
- 안쪽 노드에 꾸미기가 **값으로** 들어가는 것(에디터 조작으로 생길 수 있다)은 zod가 `docFromNode`에서 거부한다. 편집 중에 막는 일은 후속 `blockGuard`의 몫이다.

## 3. 층별 책임 — 왜 zod가 먼저인가

설치된 prosemirror-model로 확인한 사실(2026-09-24 프로브):

- `Node.fromJSON`은 스키마에 없는 attrs 키를 **조용히 버린다**(`unknown-attr` 픽스처가 오류 없이 `font: null`로 들어온다).
- attrs 값은 검사하지 않는다(`font: 5`도 들어온다). `attrs`가 없는 노드는 필수 attrs도 `null`로 채운다(2장). TipTap이 ProseMirror의 `validate`를 넘겨 주지만, 값 규칙을 두 곳에 적으면 갈라지므로 쓰지 않는다 — 값의 원천은 zod 하나다.

그래서 `docToNode`는 zod 검증을 **먼저** 하고, `docFromNode`도 나가기 전에 zod로 다시 검사한다. 스펙의 층별 표가 테스트의 원천이다.

## 4. 경계 함수가 예외를 던지는 이유

에디터 안에서 저장 불가 문서가 생기는 것은 버그(후속 blockGuard가 막을 일)이고, 저장 경로는 이미 API가 400으로 거부한다. 경계에서 조용히 고치지 않고 던져서 드러낸다. 호출하는 쪽(editor-react · web)이 잡아서 사용자에게 알린다.
