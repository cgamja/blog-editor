# editor-dom-paste 설계

근거 문서:

- TipTap: https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node (renderHTML · parseHTML) · https://tiptap.dev/docs/editor/extensions/custom-extensions/extend-existing#attributes
- ProseMirror: https://prosemirror.net/docs/ref/#model.DOMOutputSpec · https://prosemirror.net/docs/ref/#model.TagParseRule (`contentElement` · `getAttrs`) · https://prosemirror.net/docs/ref/#model.StyleParseRule · https://prosemirror.net/docs/ref/#view.EditorProps.transformPasted · https://prosemirror.net/docs/guide/#schema.serialization_and_parsing

## 1. 에디터 DOM = 공개 HTML의 어휘

content-render는 꾸밈 있는 블록을 `div.post-block`으로 감싼다. ProseMirror 노드 하나가 요소 하나일 필요는 없다. DOMOutputSpec은 중첩 배열(`["div", attrs, ["p", 0]]`)을 받고, 구멍(0)은 부모의 유일한 자식이면 된다. 거꾸로 읽을 때는 ParseRule `contentElement`로 래퍼 안의 실제 요소를 내용으로 가리킨다. 그래서 에디터 DOM과 공개 HTML이 구조까지 같다. 다른 점은 둘이다.

- **스티커를 내지 않는다.** 스티커 `img`는 구멍과 형제가 되는데, 구멍은 유일한 자식이어야 한다. 표시는 editor-react NodeView가 맡는다. 그래서 에디터 안 복사 · 붙여넣기도 스티커를 옮기지 않는다. 이것은 editor-paste 요구("붙여넣기는 스티커를 들여오지 않는다")와 같은 결과다.
- **래퍼는 첫 자식만 읽는다.** 꾸밈 래퍼 규칙은 `firstElementChild`를 노드 요소로 보고 `contentElement`로 가리킨다. content-render 출력의 래퍼는 요소 하나에 스티커 `img`가 뒤따르는 모양이라, 첫 자식이 늘 그 블록이다. 그래서 받아들인다. 사람이 손으로 쓴 HTML처럼 래퍼 안에 블록이 여럿이면 둘째부터는 이 규칙이 읽지 않는다.
- **이미지 `src`는 저장 경로 그대로다**(`/images/a.webp`). content-render는 `imageBaseUrl`을 앞에 붙이지만, editor-core는 설정을 모른다. 화면의 실제 주소는 editor-react가 정한다. 그래서 공개 사이트에서 복사한 절대 URL 이미지는 붙여넣기에서 빠진다. 절대 URL 이미지는 닫힌 집합에 자리가 없다(adr-003). base URL을 경로로 되돌리는 변환은 설정이 있는 editor-react 몫이다(후속).

## 2. attribute 단위 기본 파싱을 막는다

@tiptap/core 3.31.3 `injectExtensionAttributesToParseRule`(소스 확인, 공식 문서에는 없음)은 규칙의 `getAttrs` 결과 위에 attribute마다 `attribute.parseHTML ?? fromString(el.getAttribute(name))`을 덮는다. 그래서 `parseHTML`이 없는 attribute는 **같은 이름의 HTML 속성을 문자열 → 숫자/불리언 변환만 거쳐 그대로** 받는다. `<img width="800">`이 꾸밈 폭 800이 되고, `<p stickers="x">`가 스티커 문자열이 된다. 모든 attribute에 `parseHTML: () => null`을 두어 이 경로를 닫는다. null이면 TipTap이 덮지 않는다. 값은 노드 규칙의 `getAttrs` 한 곳에서 content-schema 상수로 검증한다.

## 3. 검증 규칙(파싱)

| 값                     | 규칙                                                                   | 어기면                                |
| ---------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| font · motion          | `FONTS` · `MOTIONS`에 있는가                                           | 없는 것(null)                         |
| width(꾸밈 %)          | `style`의 `--w:N`, `WIDTH_RANGE` 정수                                  | 없는 것                               |
| naturalWidth · Height  | `img`의 `width` · `height`, `NATURAL_SIZE_RANGE` 정수, 둘 다 있을 때만 | 둘 다 없는 것                         |
| callout tone           | `CALLOUT_TONES`                                                        | 규칙 거부 → 안의 내용은 일반 블록으로 |
| codeBlock language     | `CODE_LANGUAGE_PATTERN`                                                | 없는 것                               |
| image · screenshot src | `imagePathSchema`                                                      | 규칙 거부 → 노드 없음                 |
| alt · caption          | 문자열, `ALT_MAX_LENGTH` · `CAPTION_MAX_LENGTH`까지 자른다             | 자름(이미지를 버리지 않는다)          |
| link href              | `hrefSchema`                                                           | 규칙 거부 → 마크 없음, 글자는 남음    |
| heading level          | h2 → 2, h3 → 3, h1 → 2, h4~h6 → 3                                      | —                                     |

굵게: `strong`, `b`(단 `style`의 `font-weight`가 `normal`이면 제외 — 구글 독스가 붙여넣기 전체를 `<b style="font-weight:normal" id="docs-internal-guid-…">`로 감싼다), `font-weight` 스타일(bold · bolder · 700 이상 — 스펙과 같다. 600은 세미볼드라 굵게로 치지 않는다). 기울임: `em`, `i`, `font-style: italic`. 표를 받는 규칙은 두지 않는다. ProseMirror DOMParser는 규칙 없는 요소를 건너뛰고 자식을 읽으므로 칸의 글자는 문단이 된다.

## 4. 붙여넣기 정규화(`transformPasted`)

파싱 규칙은 값을 거르지만 **붙일 자리**는 모른다. 조각의 최상위 문단이 인용 안에 들어가면 안쪽 노드가 되는데, 안쪽 노드에는 꾸밈 자리가 없다. 그러면 blockGuard가 붙여넣기 전체를 거부한다. 그래서 `transformPasted(slice, view)`가 선택으로 자리를 판단한다. 노드 선택(`NodeSelection`)이면 `$from`이 선택된 노드의 부모 안에 있으므로, 그 노드가 최상위일 때만(`$from.depth === 0`) 최상위다. 그 밖에는 깊이 1 이하(최상위 블록 안)일 때 최상위다. 순수 함수 `normalizePastedSlice(slice, { intoTopLevel })`는 다음을 한다.

- 스티커는 늘 지운다.
- 꾸밈은 `intoTopLevel`이고 조각의 최상위 노드일 때만 남긴다.
- 링크 · 이미지 · 원본 크기 짝은 파싱 규칙과 같은 검증을 한 번 더 한다. 붙여넣기 경로가 규칙을 거쳤는지 이 함수는 모른다.

**드래그 이동은 건너뛴다.** 에디터 안 복사 · 붙여넣기는 클립보드 HTML을 거쳐 파싱 규칙으로 들어오므로 정규화 대상이다. 규칙을 거치지 않는 경로는 에디터 안 드래그다. prosemirror-view 1.42.5 `handleDrop` 소스를 보면, `view.dragging`이 있으면 파싱 없이 드래그한 조각을 그대로 `transformPasted`에 넘긴다. 옮기기(`view.dragging.move`)라면 원래 자리에서 빠지는 내부 조각이라 이미 저장 가능한 모양이다. 여기서 스티커를 지우면 옮기다가 데이터를 잃으므로 그대로 둔다. 안쪽 자리에 떨어뜨려 꾸밈이 무효가 되면 blockGuard가 트랜잭션을 거부한다. 복제 드래그(`move`가 거짓)는 스티커가 늘어나므로 정규화한다.

플러그인은 `Extension.create({ addProseMirrorPlugins })`로 감싼 `PasteNormalizer`가 `editorExtensions`에 넣는다. 그래서 에디터를 마운트하면 기본으로 켜진다.

지운 결과 조각이 비면 `Slice.empty`다. 원자 노드(이미지)는 열린 쪽 끝이 될 수 없으므로 지워도 `openStart` · `openEnd`는 그대로 둔다.

## 5. 테스트 층

레포에 DOM 구현이 없다(vitest environment node, happy-dom · jsdom 미설치 — 새 의존성은 LIBRARY 게이트). 그래서 다음처럼 검증한다.

- `toDOM`은 DOMOutputSpec 배열을 돌려주는 순수 함수라서 그대로 본다.
- 파싱 규칙의 `getAttrs`(TipTap 주입 뒤의 것)는 `getAttribute` · `querySelector`만 가진 가짜 요소로 부른다. 코드도 DOM 타입(`HTMLElement`, lib에 없음) 대신 이 최소 인터페이스만 쓴다.
- Slice 정규화는 스키마로 만든 Slice로 본다.

DOM을 실제로 파싱하는 붙여넣기(구글 독스 · 워드 원문)는 #44 실브라우저 체크리스트에 넣는다.

## 6. 나눌 때 스티커(#41 리뷰에서 찾은 버그)

꾸밈 attrs는 TipTap 기본값(`keepOnSplit: true`)이라 Enter로 나누면 `stickers`가 두 블록에 복제됐다. 스티커 7개짜리 문단을 나누면 14개가 되어 문서 상한을 넘고, blockGuard가 그 트랜잭션을 거부해 Enter가 조용히 무시됐다.

- `stickers`만 `keepOnSplit: false`다. 글꼴 · 움직임 · 폭은 이어 쓰는 블록이 같은 모양이도록 남긴다.
- `keepOnSplit`은 TipTap `splitBlock`이 **끝에서** 나눌 때만 효력이 있다. @tiptap/core 3.31.3 `splitBlock` 소스를 보면, 끝이 아니면 `tr.split`에 타입을 주지 않아 attrs를 그대로 복사한다. 게다가 TipTap chain은 중간 커맨드가 실패해도 dispatch하므로, splitBlock 뒤에 스티커 정리를 체인으로 잇는 방식은 나누지 못해도 트랜잭션이 나간다.
- 그래서 순수 커맨드 `splitBlockKeepingStickers(state, dispatch)`를 둔다.
  - prosemirror-commands 1.7.2 `splitBlockAs(splitNode)`(https://prosemirror.net/docs/ref/#commands.splitBlockAs)로 조건 · 나누기 · 스티커 처리를 한 트랜잭션에서 한다. 나누지 못하면 false이고 dispatch하지 않는다.
  - `splitNode` 콜백이 뒤 블록의 타입과 attrs를 정한다.
    - 끝에서 나누면 뒤는 기본 블록이고, 그 타입이 가진 꾸밈만 옮긴다. 스티커는 옮기지 않는다.
    - 가운데서 나누면 뒤는 같은 타입이고, 스티커를 뺀 attrs를 쓴다.
    - 맨 앞에서 나누면 뒤는 같은 타입이고 스티커까지 둔다. 새로 생긴 빈 앞 블록의 스티커는 같은 트랜잭션에서 지운다. prosemirror-commands는 제목 맨 앞에서 나눌 때 앞 블록을 기본 블록으로 바꾸는데, 이때도 스티커가 없어야 한다.
  - 코드 블록(`spec.code`), 스티커 없는 블록, 선택 없는 블록에서는 false다. 코어 Enter(코드 블록은 `newlineInCode`)에 넘긴다.
- Enter 확장 `StickerSafeSplit`은 등록만 한다: `editor.commands.command(({ state, dispatch }) => splitBlockKeepingStickers(state, dispatch))`. TipTap이 prosemirror 커맨드를 감싸는 방식과 같다(`state`는 체인의 트랜잭션을 공유한다). 우선순위 상수(`STICKER_SPLIT_PRIORITY` = 1000)로 코어 Keymap(100)보다 먼저다.
- 조합(IME) 중 Enter: 나누기 트랜잭션 안에서 attrs를 바꿀 뿐이고 뒤로 미루는 부수 효과는 없다. **실브라우저 미확인** — #44에서 본다.
