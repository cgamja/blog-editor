# Design — image-insert

## 1. 자리 표시는 장식이다

올리는 동안의 자리 표시를 문서 노드로 넣으면 저장 · 되돌리기 기록에 임시 노드가 샌다(닫힌 집합 밖). 그래서 editor-core 플러그인 상태에 `{ id, pos, status, message }`를 두고 widget 장식으로만 그린다. https://prosemirror.net/docs/ref/#view.Decoration^widget

- `pos`는 최상위 블록 사이 자리(gap)다. 트랜잭션마다 `mapping.mapResult(pos, 1)`로 옮긴다.
- 삭제가 자리를 가로지르면(`deletedAcross`) 자리는 사라지고, 끝난 업로드 결과는 버린다(되돌리기로 그 자리가 지워진 경우 포함). https://prosemirror.net/docs/ref/#transform.MapResult
- 끝나면 `finishImageUpload(id, attrs)`가 자리(가장 가까운 최상위 gap)에 image 노드를 넣고 자리를 지운다 — 한 트랜잭션, undo 1번. 넣은 그림을 노드로 고른다(대체 텍스트 입력이 바로 뜬다).
- 여러 파일은 순서대로 올린다. 같은 gap에 앞 파일 그림이 들어가면 뒤 자리는 그 뒤로 매핑된다(assoc 1).
- 장식을 그리는 함수(`render`)는 플러그인을 만드는 쪽(editor-react)이 준다 — 다시 시도 · 지우기 버튼이 React 쪽 업로드 상태(파일)를 불러야 해서다.

## 2. 브라우저 줄이기 (ADR-021)

- 순수 계산(`image-insert-model.ts`, node 테스트): 긴 변 1600 안으로 비율 유지 치수, 다음 품질(0.85 → 0.75 → 0.65 → 0.55 → 포기), GIF 원본 통과 조건, 응답 → image attrs, 상태 코드 → 문장, 이미지 파일 거르기.
- 브라우저(`encode-image.ts`): `createImageBitmap(file, { imageOrientation: "from-image" })`로 EXIF 방향을 구워 캔버스에 그리고 `toBlob("image/webp", q)`. WebP 인코딩을 못 하는 브라우저(결과 type이 webp가 아님)면 JPEG로 굽는다(캔버스 출력에는 EXIF가 없다).
- 한도 1 MiB는 `IMAGE_MAX_BYTES`(content-schema) 하나를 API와 함께 본다.

## 3. 가로채는 입력

- 붙여넣기: `clipboardData.files`에 이미지가 있으면 그 파일만 올리고 true(기본 붙여넣기 · paste-normalizer를 건너뜀). 없으면 false.
- 끌어다 놓기: `dataTransfer.files`의 이미지만. 스티커(`STICKER_DRAG_TYPE`) · 에디터 안 옮기기는 파일이 없으니 그대로 넘어간다. 놓은 좌표의 최상위 블록 위 · 아래 절반으로 gap을 고른다.
- SVG는 받지 않는다(서버도 거부).
- 한글 조합 중이면 결과를 넣는 트랜잭션을 조합이 끝날 때까지 미룬다(.claude/rules/editor.md).

## 4. 대체 텍스트

- `setImageAlt(pos, alt)`: 그 위치의 image 노드 alt만 바꾼다. `ALT_MAX_LENGTH` 초과면 false, 같은 값이면 dispatch 없음(#62 관례).
- `imageAltReminder` 플러그인: alt가 빈 image 노드에 `data-alt-missing` 노드 장식 → CSS 배지 "대체 텍스트 없음".
- UI: 그림을 고르면 폭 도구줄에 「대체 텍스트」 버튼(비어 있으면 경고 표시) → 입력칸 팝오버, Enter로 적용 · Esc로 닫기.
