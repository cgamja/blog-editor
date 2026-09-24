# image-upload-exif-after-sof (PR #83 재검사 반영)

## Why

재검사(code-review-opus)에서 나왔다. `probeJpeg`가 SOF를 만나면 바로 돌아가서, SOF 뒤에 있는 Exif APP1의 방향을 읽지 못한다 — 방향이 돌아간 JPEG가 422를 피해 뒤바뀐 크기로 저장될 수 있다. EXIF 경로의 테스트(리틀엔디언 · XMP 뒤 · 방향 1~4 · 깨진 IFD)도 부족했다.

## What Changes

- `probeJpeg`: SOF에서 크기를 기록하고 SOS · EOI(또는 세그먼트가 끝나는 곳)까지 계속 걸으며 첫 Exif APP1의 방향을 읽은 뒤 함께 돌려준다. 루프 가드(길이 2 미만이면 멈춤)는 그대로
- 테스트 헬퍼: 세그먼트 조립(`jpegFrom` · `exifApp1` · `xmpApp1` · `sof0` · `sos`)과 바이트 순서 인자

## Impact

- 새 의존성 없음. 라우트 코드 변경 없음
