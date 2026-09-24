# Design — image-upload-api

## 1. 줄이지 않는다 (ADR-021)

서버는 이미지 코덱을 갖지 않는다. 긴 변이 1600px을 넘으면 422로 거절하고, 브라우저가 줄여서 다시 올린다. plan 3-8이 이미 브라우저 줄이기 + presigned 직접 업로드로 정했고, 배포에서는 파일이 API를 거치지 않는다.

## 2. 형식은 매직 바이트로 (`probeImage`)

확장자 · Content-Type · 파일 이름은 보지 않는다. 앞부분 바이트만 읽는 순수 함수가 형식과 크기를 돌려주고, 모르면 null이다.

| 형식 | 서명                             | 가로 · 세로                                                                                                           |
| ---- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| PNG  | `89 50 4E 47 0D 0A 1A 0A` + IHDR | 16 · 20바이트, u32 BE                                                                                                 |
| GIF  | `GIF87a` · `GIF89a`              | 6 · 8바이트, u16 LE                                                                                                   |
| WebP | `RIFF` ···· `WEBP`               | `VP8 `: 26 · 28바이트 u16 LE의 하위 14비트 / `VP8L`: 21바이트부터 14비트씩(값+1) / `VP8X`: 24 · 27바이트 u24 LE(값+1) |
| JPEG | `FF D8`                          | 마커를 따라가 SOF(C0–CF, C4 · C8 · CC 제외)의 높이 · 너비 u16 BE                                                      |

SVG(`<svg` · `<?xml`)는 서명이 없으니 null이 되어 415다. 가로나 세로가 0이면 null이다.

## 3. 이름은 내용 해시

`sha256(bytes)`의 16진수 앞 32자(128비트) + 확장자(jpeg는 `jpg`). imagePathSchema(`/images/[a-z0-9-]+.(webp|png|jpg|jpeg|gif)`)를 그대로 통과한다. 같은 파일을 두 번 올리면 같은 경로이고, 이미 있으면 200, 새로 쓰면 201이다.

## 4. 저장소

```ts
interface ImageStore {
  has(name: string): Promise<boolean>;
  put(name: string, bytes: Uint8Array): Promise<void>;
  get(name: string): Promise<Uint8Array | null>;
}
```

로컬 파일 구현은 이름을 다시 검사한다(해시 32자 + 허용 확장자). 경로 밖으로 나갈 이름은 모양에서 걸린다. 쓰기는 임시 파일 → rename(file-store와 같은 관례).

## 5. 요청 모양

본문 = 이미지 바이트 그대로(multipart 아님). 브라우저는 `fetch(url, { method: "POST", body: blob })`로 보낸다. 용량은 Hono 내장 `bodyLimit`(`hono/body-limit`)으로 읽기 전에 자른다(413).

CSRF: 기존 API와 같다. 세션 쿠키가 `SameSite=Strict`라 다른 사이트에서 보낸 요청에는 쿠키가 실리지 않아 401이다.

## 6. 응답 · 오류

| 경우                        | 상태                                        |
| --------------------------- | ------------------------------------------- |
| 세션 없음                   | 401 (기존 `/api/*` 미들웨어)                |
| 1 MiB 초과                  | 413                                         |
| 모르는 형식 · SVG · 빈 본문 | 415                                         |
| 긴 변 1600px 초과           | 422, "긴 변을 1600px 이하로 줄여서"         |
| 새로 저장                   | 201 `{ path, naturalWidth, naturalHeight }` |
| 이미 있음                   | 200 같은 모양                               |

`GET /images/:name`: 이름 모양이 아니면 404(경로 모양을 알려 주지 않는다), 없으면 404. 있으면 200, `Content-Type`(확장자에서), `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`(내용 해시라 바뀌지 않는다).
