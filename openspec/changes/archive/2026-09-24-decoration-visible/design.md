# Design — decoration-visible (이슈 #58)

## 1. 스티커를 toDOM에 싣는다 (NodeView를 쓰지 않는다)

전 spec(editor-dom)은 "스티커는 DOM으로 내보내지 않는다 — 구멍(0)은 부모의 유일한 자식이어야 해서 형제로 둘 수 없고, 표시는 NodeView 몫"이라 적었다. 제약을 다시 읽으면 **구멍의 부모**(`p`)만 유일한 자식이어야 한다(https://prosemirror.net/docs/ref/#model.DOMOutputSpec — "the hole … must be the only child of its parent node"). 래퍼 `div.post-block`은 `[p(0), img, img]`처럼 자식을 여럿 가질 수 있다. content-render가 내는 구조(래퍼 안 요소 뒤 스티커)와 똑같다.

고른 이유:

- NodeView는 `update` · `ignoreMutation` · `destroy` 생명주기를 새로 떠안는다(https://prosemirror.net/docs/ref/#view.NodeView). toDOM이면 ProseMirror 기본 노드 뷰가 attrs가 바뀔 때 다시 그린다 — 스티커를 바꾸는 트랜잭션도 같은 길로 간다
- 편집 가능한 내용(`contentDOM`)은 구멍의 부모 `p`뿐이라, 스티커 `img`는 글자 흐름 · 선택 · 한글 조합에 끼지 않는다. 조합 중 문서를 바꾸는 부수 효과도 없다(데코레이션 · 플러그인 없음)
- widget Decoration(https://prosemirror.net/docs/ref/#view.Decoration^widget)은 위치가 문서 안(글자 사이)이라 atom 블록(이미지 · 구분선)에는 넣을 자리가 없고, 텍스트 블록에서는 캐럿 옆에 끼어든다

스티커 `img`에는 `contenteditable="false"`(편집 불가 장식) · `draggable="false"`(브라우저 기본 이미지 끌기가 본문에 복사본을 떨어뜨리지 않게)를 더한다. 끌어 옮기기는 #61이 따로 만든다.

## 2. 공개 HTML과 다른 점 — src · 크기 속성

- `src`는 에디터 출처 기준 `/stickers/{id}.png`다. 에디터의 이미지도 저장 경로(`/images/…`)를 그대로 `src`로 쓴다. 배포(M4)에서는 에디터 출처의 CloudFront 한 배포가 `/stickers/*` · `/images/*`를 자산 버킷으로 경로 라우팅한다(리뷰에서 정함). 공개 HTML(content-render)은 `{imageBaseUrl}/stickers/{id}.png`
- `width` · `height` · `loading` · `decoding`은 내지 않는다. 크기 상수(`STICKER_SIZES`)는 content-render에 있고 editor-core는 content-render를 import할 수 없다(adr-009). 스티커는 `position: absolute`라 크기 속성이 없어도 레이아웃 이동이 없다(post.css `.post-sticker`)

## 3. 복사 · 붙여넣기

toDOM은 클립보드 HTML 직렬화에도 쓰인다. 래퍼 규칙(`wrapperRule`)은 내용을 첫 자식(`contentElement`)에서만 읽고, atom은 안쪽을 읽지 않는다 — 스티커 `img`가 붙여넣기에서 이미지 블록이 되지 않는다(`DOMParser.parseSlice` 테스트로 고정).

**에디터 안 복사 · 붙여넣기에서도 스티커는 사라진다.** `data-pm-slice`는 slice의 open 깊이와 context만 담고, 내용은 클립보드 HTML을 다시 파싱해 만든다(https://prosemirror.net/docs/ref/#view.EditorProps.clipboardSerializer). HTML에서 스티커를 **읽는** 규칙이 없으니(spec 그대로) 복사한 블록은 스티커를 잃는다. 이 PR 전에도 같았다. 읽는 규칙은 후속 [#65](https://github.com/cgamja/blog-editor/issues/65)로 뺐다 — 붙여넣기 정규화 · 문서당 12개 상한과 함께 정해야 한다.

## 4. 스티커 파일 자리

`packages/content-render/assets/stickers/{id}.png` — 스티커 id 목록(content-schema)과 크기 상수(content-render `STICKER_SIZES`)의 짝이 되는 원본이다. 배포(M4 infra)는 이 폴더를 자산 버킷의 `stickers/`에 올리고, 에디터 출처의 CloudFront 배포가 `/stickers/*`를 그 버킷으로 라우팅한다(2절). 사이트 `public/stickers/`에서 바이트 그대로 복사했다(코드 의존 아님). 테스트가 PNG 헤더의 크기와 `STICKER_SIZES`를 대조해 둘이 어긋나지 않게 한다. WebP 변환 · 장당 20KB 게이트는 Lighthouse CI 이슈 몫이다(지금 PNG는 14~27KB).

## 5. 편집 중 움직임 끄기

post.css의 움직임은 스크롤 진입 애니메이션(`animation-timeline: view()`)이다. 편집 중에 블록이 스크롤마다 사라졌다 나타나면 쓰기 어렵다. editor.css에서 `.blog-editor .ProseMirror [data-motion] { animation-name: none }` — post.css의 `.post-body [data-motion="…"]`(명시도 0,2,0)보다 높은 0,3,0이라 순서와 무관하게 이긴다. 미리보기(content-render HTML)에서는 그대로 재생된다.
