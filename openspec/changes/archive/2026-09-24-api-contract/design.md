# api-contract — 설계

## 1. 원천 형식은 JSON

`api/openapi.yaml` 대신 `api/openapi.json`이다. 계약 테스트가 파일을 읽어 코드가 만든 문서와 비교해야 하는데, 레포가 선언한 의존성에 YAML 파서가 없다(`yaml` · `js-yaml`은 다른 도구의 전이 의존성일 뿐). JSON은 YAML 1.2의 부분집합이라 OpenAPI 도구(orval · redocly · oasdiff)가 그대로 읽는다.

## 2. 원천은 코드에서 내보낸다 (가이드 §5-2)

백엔드가 우리 것이므로 스펙을 손으로 쓰지 않는다. 손으로 쓰면 zod 규칙(문서 스키마 · 메타 규칙)을 두 번 적게 된다.

- `contract/api-schemas.ts`: 요청 · 응답 zod 스키마(메시지 오류, 스키마 오류, 글 요약, 저장 결과, 이미지 결과, 로그인 본문). 문서 · 메타 · 공개 응답은 content-schema 팩토리를 그대로 쓴다
- `contract/openapi.ts`: 경로 · 메서드 · 상태 코드 표에서 `buildOpenApiDocument()`가 OpenAPI 3.1 객체를 만든다. 컴포넌트 스키마는 `z.toJSONSchema`
- `contract/write-openapi.ts`: 문서를 `api/openapi.json`에 쓴다(`node apps/editor/api/src/contract/write-openapi.ts`, 이어서 prettier)

refine · superRefine(스티커 합계 12개, 두께-글꼴 등)은 JSON Schema로 표현되지 않는다. 계약의 `description`에 "최종 검증은 서버의 zod"라고 적고, 그런 규칙 위반은 400 `SchemaErrorBody`로 돌아온다고 명시한다.

## 3. 카테고리는 워크스페이스 설정

`meta.category`는 zod에서 `z.enum(categories)`인데 목록은 워크스페이스 설정이다(설정 API는 아직 없음). 계약에는 표식 카테고리로 만든 뒤 그 enum을 `{ type: "string", description }`로 바꾼다. 특정 워크스페이스의 목록이 계약에 새지 않는다.

## 4. 계약 테스트 셋

- 드리프트: `buildOpenApiDocument()`와 커밋된 파일이 깊이 같다. 다르면 내보내기 명령을 안내한다(테스트가 파일을 고치지 않는다)
- 라우트 목록: `app.routes`(메서드 · 경로, 미들웨어 제외, `/mcp` · OAuth 제외)가 계약의 경로 · 메서드와 같다. 계약에 없는 라우트가 생기면 실패한다
- 응답 적합성: 라우트를 실제로 불러 상태 코드가 계약에 선언돼 있고 본문이 그 상태의 zod 스키마를 통과한다. zod 스키마는 문서를 만든 바로 그 표에서 꺼낸다 — 문서와 검증이 같은 원천이다

## 5. 발행은 따로 없다

발행은 `PUT /api/posts/{slug}`에 `meta.draft: false`로 저장하는 것이다. 계약의 설명에 그렇게 적고, 발행 전용 엔드포인트 · 주소 잠금은 제안으로 남긴다.
