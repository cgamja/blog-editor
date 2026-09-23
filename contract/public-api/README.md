# 공개 조회 계약 픽스처 (`GET /public/posts`)

사이트 레포(`simsimeestudio-intro`)가 빌드할 때 받는 응답의 **계약 픽스처**다. M1에서 API(`apps/editor/api`)가 생기기 전까지 사이트는 이 디렉터리를 정적 서버로 띄워 빌드한다. 모양은 `openspec/specs/public-posts-contract/spec.md`(아카이브 전에는 `openspec/changes/public-posts-contract/specs/…`), 스키마는 `@blog-editor/content-schema`의 `createPublicPostsResponseSchema`다. 사이트는 이 코드를 import하지 않고 자기 zod로 같은 모양을 검증한다.

| 파일              | 내용                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `public/posts`    | 응답 JSON — 대표 픽스처 3개(`beta-open` · `feature-tour` · `decoration-max`)를 발행 상태로 렌더한 것 |
| `public/post.css` | 본문용 CSS 사본(`packages/content-render/src/post.css`와 같다)                                       |

## 띄우기

```bash
python3 -m http.server 4010 --directory contract/public-api
# 사이트 레포에서
BLOG_API_URL=http://localhost:4010 pnpm build
```

## 다시 만들기

손으로 고치지 않는다. 렌더러나 CSS가 바뀌면 `packages/content-render/src/contract.test.ts`가 실패한다. 아래 명령으로 다시 만들고 diff를 사람이 본다.

```bash
pnpm vitest run packages/content-render/src/contract.test.ts -u
```

파일이 **없으면** 로컬 실행은 새로 만들고 통과한다. CI(`CI=true`)에서만 실패하므로 새로 생긴 파일은 커밋한다. M1에서 API 핸들러가 생기면 테스트 안의 응답 조립 대신 핸들러 출력을 비교한다.

이미지 주소(본문 `imageBaseUrl`과 `image`)는 `https://simsimeestudio.com` 기준이다. 스티커(`/stickers/*.png`)는 사이트에 있고, 본문 이미지(`/images/*`)는 없는 경로라 깨져 보이는 것이 정상이다.
