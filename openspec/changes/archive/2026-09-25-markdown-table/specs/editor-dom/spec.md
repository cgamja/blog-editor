## MODIFIED Requirements

### Requirement: 에디터 DOM은 공개 HTML과 같은 어휘로 나가고 다시 읽힌다

에디터 스키마의 노드 · 마크는 SHALL content-render 출력과 같은 태그 · 클래스 · data 속성으로 DOM을 만들고, 같은 모양의 HTML을 다시 읽어 같은 attrs를 만든다. 꾸밈(`font` · `motion` · `width`)이나 스티커가 있는 최상위 블록은 `div.post-block`으로 감싸고(`data-font` · `data-motion` · `style="--w:N"`), 없으면 요소만 낸다. 스티커는 블록 요소 뒤(같은 래퍼 안)에 순서대로 `img.post-sticker[src="/stickers/{id}.png"][alt=""][contenteditable=false][draggable=false][style="--x:{x};--y:{y};--s:{size};--r:{rotate}"]`로 낸다. 콜아웃은 `aside.post-callout[data-tone]`, 이미지는 `figure.post-image > img`(원본 크기는 `width` · `height`), 앱 스크린샷은 `figure.post-screenshot > img + figcaption`, 코드 블록은 `pre > code[data-language]`, 표는 `div.post-table-scroll > table > tbody > tr > td`(머리 행도 `td` — 머리 행은 자리다, 칸 안은 `p`, 머리 행 칸의 열 정렬은 `td[data-align]`)다(adr-028). HTML에서 스티커를 읽는 규칙은 없다.

#### Scenario: 꾸밈이 있는 블록은 공개 HTML과 같은 래퍼로 나간다

- **WHEN** `font: "jua"` · `motion: "fade-up"` · 스티커 하나(`heart`, x 50 · y 30 · size 20 · rotate 0)가 있는 문단, `width: 60`인 이미지, 꾸밈 없는 문단을 DOM 스펙으로 낸다
- **THEN** 차례로 `div.post-block[data-font=jua][data-motion=fade-up] > p + img.post-sticker[src="/stickers/heart.png"][style="--x:50;--y:30;--s:20;--r:0"]`, `div.post-block[style="--w:60"] > figure.post-image > img`, `p`다

#### Scenario: 스티커만 있는 atom 블록도 래퍼 안에 스티커를 낸다

- **WHEN** 스티커 두 개(`star-coral`, `cloud`)만 있는 구분선을 DOM 스펙으로 낸다
- **THEN** `div.post-block > hr + img.post-sticker + img.post-sticker`이고 래퍼에 `data-*` · `style`이 없다

#### Scenario: 픽스처의 블록은 DOM을 거쳐도 attrs가 같다

- **WHEN** 픽스처 `decorationMax` · `allBlocks`의 최상위 블록을 DOM 스펙으로 낸 뒤 그 모양을 파싱 규칙으로 다시 읽는다
- **THEN** 스티커를 뺀 attrs가 원래와 같다

#### Scenario: 스티커 img는 파싱에서 블록이 되지 않는다

- **WHEN** 스티커가 있는 문단 · 구분선의 DOM 스펙에서 스티커 `img`의 `src`를 이미지 경로 규칙을 통과하는 값(`/images/…`)으로 바꾸고, 같은 `img` 하나를 래퍼 밖에 더해 `DOMParser.fromSchema(schema).parseSlice`로 읽는다
- **THEN** 최상위 블록은 문단 · 구분선 · 이미지 셋이고 `image` 노드는 래퍼 밖 것 하나뿐이다 — 래퍼 구조(`contentElement` · atom)가 스티커를 막는다
