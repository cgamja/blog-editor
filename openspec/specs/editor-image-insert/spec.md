# editor-image-insert Specification

## Purpose

에디터에서 이미지를 넣는 길(「+」 메뉴의 파일 고르기 · 붙여넣기 · 끌어다 놓기)과 브라우저 줄이기(ADR-021), 올리는 동안의 자리 표시(문서가 아닌 장식), 대체 텍스트 입력 · 누락 알림을 정한다. 서버 쪽 검사 · 저장은 image-upload-api가 맡는다(이슈 #92).

## Requirements

### Requirement: 올리는 동안의 자리 표시는 문서가 아니라 장식이다

에디터는 SHALL 이미지를 올리는 동안의 자리를 editor-core 플러그인 상태(`{ id, pos, status, message }`)에만 두고 widget 장식으로 그린다. 문서(저장 형식)에는 임시 노드가 들어가지 않는다. `pos`는 최상위 블록 사이 자리이고 트랜잭션마다 매핑된다. 삭제가 그 자리를 가로지르면 자리는 사라진다. 문서 맨 앞 · 맨 끝 자리는 경계가 아닌 쪽이 지워지면 사라진다.

#### Scenario: 자리를 더해도 문서는 그대로다

- **WHEN** 두 문단 문서의 첫 문단 뒤 자리에 `startImageUpload("a", pos)`를 적용한다
- **THEN** 문서는 그대로이고 플러그인 상태에 `a`가 그 자리 · `uploading`으로 있다

#### Scenario: 앞에 글이 늘면 자리가 따라간다

- **WHEN** 자리를 더한 뒤 첫 문단에 글자를 넣는다
- **THEN** 자리의 `pos`가 넣은 글자 수만큼 뒤로 옮겨져 여전히 두 문단 사이다

#### Scenario: 자리를 가로질러 지우면 자리가 사라진다

- **WHEN** 자리를 더한 뒤 두 문단에 걸친 범위를 지운다
- **THEN** 플러그인 상태에 `a`가 없다

#### Scenario: 문서 전체를 바꾸면 맨 앞 · 맨 끝 자리도 사라진다

- **WHEN** 문서 맨 앞 · 맨 끝 자리를 둔 뒤 문서 전체를 빈 문단으로 바꾼다
- **THEN** 두 자리 모두 없다

### Requirement: 올리기가 끝나면 자리에 그림을 한 번 넣는다

`finishImageUpload(id, attrs)`는 SHALL 자리가 있으면 그 자리(최상위 gap)에 image 노드를 넣고 자리를 지운다 — 한 트랜잭션이다. 자리를 둘 때의 선택이 그대로면 넣은 그림을 노드로 고르고 스크롤하며, 그사이 선택이 바뀌었으면 선택을 뺏지 않는다(삽입에 맞춰 매핑만). 자리가 없으면(지워졌거나 취소됨) false이고 문서는 그대로다. 실패는 `failImageUpload(id, message)`로 자리의 상태만 `failed`로 바꾼다.

#### Scenario: 끝나면 자리에 그림이 들어가고 자리는 사라진다

- **WHEN** 첫 문단 뒤 자리 `a`에 `finishImageUpload("a", { src: "/images/x.webp", alt: "", naturalWidth: 800, naturalHeight: 600 })`
- **THEN** 두 번째 최상위 블록이 그 image 노드이고, 선택은 그 노드이며, 자리 `a`는 없다

#### Scenario: 쓰는 중이면 커서를 뺏지 않는다

- **WHEN** 자리를 둔 뒤 커서를 다른 문단으로 옮기고 `finishImageUpload`
- **THEN** 그림은 들어가지만 선택은 옮긴 커서(삽입만큼 밀린 자리)의 글자 선택이다

#### Scenario: 지워진 자리의 결과는 버린다

- **WHEN** 자리가 가로지른 삭제로 사라진 뒤 `finishImageUpload("a", …)`
- **THEN** false이고 문서는 그대로다

#### Scenario: 실패하면 자리에 이유가 남는다

- **WHEN** `failImageUpload("a", "이미지는 1MB 이하만 올릴 수 있다")`
- **THEN** 자리 `a`의 상태가 `failed`이고 그 문장을 가진다

### Requirement: 브라우저가 이미지를 한도 안으로 줄여서 올린다

에디터는 SHALL 올리기 전에 긴 변을 1600px 안으로 비율을 지켜 줄이고(원본 크기로 풀지 않고 목표 크기로 디코드) WebP로 구우며(EXIF 방향 반영), 결과가 `IMAGE_MAX_BYTES`(1 MiB)를 넘으면 품질을 0.85 → 0.75 → 0.65 → 0.55로 낮춰 다시 굽는다. WebP를 못 굽는 브라우저는 흰 바탕 JPEG로 굽는다. 그래도 넘으면 올리지 않고 이유를 보인다. 한도 안의 GIF는 원본을 그대로 올린다. SVG · 이미지가 아닌 파일은 받지 않는다(거르기는 editor-core imageFilesOf).

#### Scenario: 긴 변을 1600 안으로 줄인다

- **WHEN** 4000×3000, 1200×2400, 800×600 치수를 줄인다
- **THEN** 1600×1200, 800×1600, 800×600이다

#### Scenario: 품질을 단계대로 낮추고 끝나면 포기한다

- **WHEN** 첫 품질, 0.85 다음, 0.55 다음을 묻는다
- **THEN** 0.85, 0.75, 없음(null)이다

#### Scenario: 한도 안의 GIF만 원본 그대로다

- **WHEN** 500KB 800×600 GIF, 2MB GIF, 2000×100 GIF, 500KB PNG를 판정한다
- **THEN** 첫 GIF만 원본 통과다

#### Scenario: 이미지 파일만 고른다

- **WHEN** image/png · image/svg+xml · text/plain · image/heic 파일을 거른다
- **THEN** image/png · image/heic만 남는다

### Requirement: 올리기 응답과 오류를 에디터가 읽는다

editor-react는 SHALL 서버 주소 · 인증을 모르고 `ImageUploader(blob, signal)`를 주입받는다(BlogEditor · EditorScreen `uploadImage`, web은 TanStack Query 뮤테이션). 주입이 없으면 이미지 넣기 길(「+」 · `/` 메뉴 「이미지」, 붙여넣기 · 끌어다 놓기)을 열지 않는다. 응답 해석은 `uploadResultFrom`으로 내보낸다: `{ path, naturalWidth, naturalHeight }`는 image attrs(`alt` 빈 문자열)로, 모양이 틀리면 실패로 본다. 오류는 413 · 415 · 422면 API의 `message`를 그대로, 401이면 "로그인이 필요해요"를, 그 밖이면 일반 문장을 보인다. 올리기 줄은 에디터가 바뀌면 진행 중인 것을 끊고, 한 장이 예외여도 실패 자리를 두고 계속 돌며, 30초를 넘으면 연결 실패로 보인다.

#### Scenario: 응답을 image attrs로 바꾼다

- **WHEN** `{ path: "/images/ab.webp", naturalWidth: 800, naturalHeight: 600 }`
- **THEN** `{ src: "/images/ab.webp", alt: "", naturalWidth: 800, naturalHeight: 600 }`이고, 경로 규칙 밖(`https://…`)이면 null이다

#### Scenario: 상태 코드마다 알맞은 문장이다

- **WHEN** 413(`message` 있음) · 401 · 500을 문장으로 바꾼다
- **THEN** API 문장 그대로 · "로그인이 필요해요" · 일반 실패 문장이다

### Requirement: 그림의 대체 텍스트를 넣을 수 있고 비어 있으면 알린다

`setImageAlt(pos, alt)`는 SHALL 그 위치의 image 노드 alt만 바꾼다. `ALT_MAX_LENGTH`를 넘거나 image가 아니면 false, 같은 값이면 dispatch하지 않고 true다. `imageAltReminder` 플러그인은 alt가 빈 image 노드에 `data-alt-missing` 장식을 단다.

#### Scenario: 대체 텍스트를 넣으면 경고 장식이 사라진다

- **WHEN** alt가 빈 그림에 `setImageAlt(pos, "낮잠 자는 아기")`
- **THEN** alt가 바뀌고, 적용 전에는 그 노드에 `data-alt-missing` 장식이 있고 적용 뒤에는 없다

#### Scenario: 한도를 넘으면 거절한다

- **WHEN** `ALT_MAX_LENGTH + 1`자를 넣는다
- **THEN** false이고 문서는 그대로다

실패 의미론: 해당 없음 — 서버 상태는 이미지 올리기 API(#83)가 맡고, 이 capability는 에디터 상태만 바꾼다.

### Requirement: 붙여넣기 · 끌어다 놓기는 이미지 파일만 가로챈다

editor-core `imageFileInput({ onFiles })` 플러그인은 SHALL 붙여넣기 · 놓기에 이미지 파일(SVG 제외)이 있을 때만 가로채 넣을 자리(최상위 gap)와 함께 넘긴다. 붙여넣기는 글(text/plain)이 있거나 HTML이 img 하나(겉 태그 제외)가 아니면 파일이 있어도 기존 붙여넣기로 둔다 — Excel · Word · Numbers는 글과 함께 미리보기 PNG를 싣는다.

#### Scenario: 스크린샷 · 웹 이미지 한 장은 파일로 받는다

- **WHEN** 글 없는 붙여넣기, `<meta charset><img>` 하나뿐인 붙여넣기를 판정한다
- **THEN** 둘 다 파일로 받는다

#### Scenario: 글 · 표가 함께 오면 글로 둔다

- **WHEN** 표 HTML + 글, 문단 HTML만, 글만 있는 붙여넣기를 판정한다
- **THEN** 모두 가로채지 않는다

### Requirement: 슬래시 메뉴의 「이미지」는 동작 항목이다

「+」 메뉴와 `/` 메뉴는 SHALL 블록 종류 뒤에 같은 동작 항목 목록(「이미지」)을 붙인다 — 올릴 곳이 없으면 빠진다. `/이미지` · `/image` · `/사진` 등으로 거를 수 있다. 고르면 `clearSlashQuery`가 `/거르기`를 지우고 메뉴를 닫으며(되돌리기 묶음을 끊는다), 결과를 넣을 자리는 `slashActionGap` — 문단이 비면 그 문단 앞, 글자가 남으면 그 문단 뒤다.

#### Scenario: 빈 문단의 /이미지는 그 문단 앞 자리다

- **WHEN** 빈 문단에서 `/이미지`
- **THEN** 동작 자리는 그 문단 앞이고, `clearSlashQuery` 뒤 문단은 비고 메뉴는 닫힌다

#### Scenario: 글자 뒤 /image는 그 문단 뒤 자리다

- **WHEN** "가 " 뒤 `/image`
- **THEN** 동작 자리는 `/image`를 지운 그 문단 뒤이고 문단은 "가 "로 남는다

#### Scenario: 메뉴가 닫혀 있으면 동작이 없다

- **WHEN** 메뉴가 닫혀 있다
- **THEN** `slashActionGap`은 null, `clearSlashQuery`는 false다

#### Scenario: 동작 항목은 쓸 수 있을 때만 걸러진다

- **WHEN** 이미지 동작이 있을 때 "이미지" · "image" · "사진"으로, 없을 때 "이미지"로 거른다
- **THEN** 있으면 이미지 동작이 맞고(빈 거르기면 맨 끝), 없으면 빠진다
