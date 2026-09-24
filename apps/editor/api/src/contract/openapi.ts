import { z } from "zod";
import {
  createPostFileSchema,
  createPublicPostsResponseSchema,
  docSchema,
  markSchema,
  slugSchema,
} from "@blog-editor/content-schema";
import {
  createPostListSchema,
  imageUploadResultSchema,
  loginBodySchema,
  messageBodySchema,
  previewResultSchema,
  renameResultSchema,
  saveResultSchema,
  schemaErrorBodySchema,
} from "./api-schemas";
import { CONTENT_TYPE_OF } from "../images";
import { previewBodySchema } from "../post-preview";
import { renameBodySchema } from "../post-rename";
import {
  IMAGE_FORMAT_MESSAGE,
  IMAGE_ROTATED_MESSAGE,
  IMAGE_TOO_LARGE_MESSAGE,
  IMAGE_TOO_WIDE_MESSAGE,
} from "../messages";
import { SESSION_COOKIE_NAME } from "../session";
import type {
  ContractOperation,
  ContractParameter,
  ContractRequestBody,
  ContractResponse,
} from "./openapi.types";

export type { ContractOperation, ContractResponse, HttpMethod } from "./openapi.types";

type Categories = readonly [string, ...string[]];
type JsonObject = Record<string, unknown>;

/** 계약 문서에서 워크스페이스 카테고리 자리를 가리키는 표식 — 문서를 만든 뒤 문자열 규칙으로 바꾼다 */
const CATEGORY_MARKER = "__workspace-category__";
const CATEGORY_DESCRIPTION =
  "워크스페이스 설정의 카테고리 중 하나 — 목록은 설정이 주고, 서버의 zod가 최종 검증한다";
const COMPONENTS_PREFIX = "#/components/schemas/";
/** zod가 레지스트리 밖 공유 정의를 모으는 이름(z.toJSONSchema 레지스트리 모드) */
const ZOD_SHARED_ID = "__shared";
const SESSION_SCHEME = "session";
const JSON_MEDIA_TYPE = "application/json";
const IMAGE_MEDIA_TYPES = [...new Set(Object.values(CONTENT_TYPE_OF))];
const OPENAPI_VERSION = "3.1.0";
const API_VERSION = "1";
const API_DESCRIPTION =
  "blog-editor 백오피스 API. 이 파일은 apps/editor/api/src/contract에서 내보낸 것이다 — 손으로 고치지 않고 `node apps/editor/api/src/contract/write-openapi.ts`로 다시 쓴다. zod의 refine 규칙(스티커 합계, 글꼴별 두께 등)은 JSON Schema로 표현되지 않으며, 어기면 400 SchemaErrorBody다. `/mcp`와 OAuth 경로는 MCP 프로토콜이라 이 계약 밖이다.";

/** 계약의 이름 붙은 스키마 — 문서의 `components.schemas`와 계약 테스트의 응답 검증이 같은 인스턴스를 쓴다 */
function contractSchemas(categories: Categories) {
  return {
    PostFile: createPostFileSchema({ categories }),
    Doc: docSchema,
    Mark: markSchema,
    PostList: createPostListSchema({ categories }),
    PublicPosts: createPublicPostsResponseSchema({ categories }),
    LoginBody: loginBodySchema,
    SaveResult: saveResultSchema,
    RenameBody: renameBodySchema,
    RenameResult: renameResultSchema,
    PreviewBody: previewBodySchema,
    PreviewResult: previewResultSchema,
    ImageUploadResult: imageUploadResultSchema,
    MessageBody: messageBodySchema,
    SchemaErrorBody: schemaErrorBodySchema,
    SaveBadRequestBody: z.union([schemaErrorBodySchema, messageBodySchema]),
  } satisfies Record<string, z.ZodType>;
}

type ContractSchemas = ReturnType<typeof contractSchemas>;

function operationsFrom(schemas: ContractSchemas): ContractOperation[] {
  const unauthorized: ContractResponse = {
    description: "로그인이 필요하다",
    schema: schemas.MessageBody,
  };
  const slugParameter: ContractParameter = {
    name: "slug",
    in: "path",
    required: true,
    description: "글 주소 — 소문자 · 숫자 · 하이픈",
    schema: slugSchema,
  };
  return [
    {
      method: "post",
      path: "/api/session",
      operationId: "login",
      tag: "session",
      summary: "로그인",
      description: "성공하면 세션 쿠키를 심는다. 실패가 이어지면 잠시 잠긴다(api-session).",
      requiresSession: false,
      requestBody: { description: "아이디와 비밀번호", schema: schemas.LoginBody },
      responses: {
        204: { description: "로그인됨", headers: { "Set-Cookie": "세션 쿠키" } },
        400: { description: "본문이 JSON이 아니거나 필드가 빠졌다", schema: schemas.MessageBody },
        401: { description: "아이디 또는 비밀번호가 맞지 않는다", schema: schemas.MessageBody },
      },
    },
    {
      method: "delete",
      path: "/api/session",
      operationId: "logout",
      tag: "session",
      summary: "로그아웃",
      description: "멱등 — 세션이 없거나 만료돼도 204다.",
      requiresSession: false,
      responses: { 204: { description: "세션 쿠키를 지웠다" } },
    },
    {
      method: "get",
      path: "/api/posts",
      operationId: "listPosts",
      tag: "posts",
      summary: "글 목록",
      description: "초안과 발행 글 모두, date 최신순.",
      requiresSession: true,
      responses: {
        200: { description: "글 요약 목록", schema: schemas.PostList },
        401: unauthorized,
      },
    },
    {
      method: "get",
      path: "/api/posts/{slug}",
      operationId: "getPost",
      tag: "posts",
      summary: "글 읽기",
      requiresSession: true,
      parameters: [slugParameter],
      responses: {
        200: {
          description: "저장 형식 그대로",
          schema: schemas.PostFile,
          headers: { ETag: "revision — 고쳐 저장할 때 If-Match로 돌려준다" },
        },
        400: { description: "주소 모양이 틀렸다", schema: schemas.MessageBody },
        401: unauthorized,
        404: { description: "글이 없다", schema: schemas.MessageBody },
      },
    },
    {
      method: "put",
      path: "/api/posts/{slug}",
      operationId: "savePost",
      tag: "posts",
      summary: "글 저장(새 글 · 고치기 · 발행)",
      description:
        "새 글은 If-None-Match: *, 고치기는 If-Match: <ETag>. 발행은 meta.draft를 false로 저장하는 것이다(발행 전용 경로 없음). 본문의 doc은 저장 전에 정규형으로 바뀐다.",
      requiresSession: true,
      parameters: [
        slugParameter,
        {
          name: "If-None-Match",
          in: "header",
          required: false,
          description: "`*` — 새 글일 때만 저장. 그 주소에 글이 이미 있으면 409",
        },
        {
          name: "If-Match",
          in: "header",
          required: false,
          description: "읽을 때 받은 ETag — 그 뒤 다른 곳에서 고쳤거나 그 주소에 글이 없으면 409",
        },
      ],
      requestBody: { description: "저장 형식", schema: schemas.PostFile },
      responses: {
        200: {
          description: "고쳐 저장됨",
          schema: schemas.SaveResult,
          headers: { ETag: "새 revision" },
        },
        201: {
          description: "새로 저장됨",
          schema: schemas.SaveResult,
          headers: { ETag: "새 revision" },
        },
        400: {
          description:
            "주소 모양이 틀렸거나(MessageBody) 본문이 JSON이 아니거나 스키마에 맞지 않는다(SchemaErrorBody)",
          schema: schemas.SaveBadRequestBody,
        },
        401: unauthorized,
        409: {
          description:
            "revision이 맞지 않는다 — If-Match: 다른 곳에서 먼저 고쳤거나 글이 없다 · If-None-Match: *: 그 주소에 글이 이미 있다",
          schema: schemas.MessageBody,
        },
        428: { description: "If-None-Match · If-Match가 둘 다 없다", schema: schemas.MessageBody },
      },
    },
    {
      method: "post",
      path: "/api/posts/{slug}/rename",
      operationId: "renamePost",
      tag: "posts",
      summary: "초안 주소 바꾸기",
      description:
        "새 주소에 쓰고 옛 주소를 지운다. 발행한 글은 주소가 URL이라 잠겨 있다. 옛 주소의 글은 없어진다.",
      requiresSession: true,
      parameters: [
        slugParameter,
        {
          name: "If-Match",
          in: "header",
          required: true,
          description: "읽을 때 받은 ETag — 그 뒤 다른 곳에서 고쳤으면 409",
        },
      ],
      requestBody: { description: "새 주소", schema: schemas.RenameBody },
      responses: {
        200: {
          description: "옮겼다",
          schema: schemas.RenameResult,
          headers: { ETag: "새 주소의 revision" },
        },
        400: {
          description: "주소 모양이 틀렸거나 본문이 JSON이 아니다",
          schema: schemas.MessageBody,
        },
        401: unauthorized,
        404: { description: "글이 없다", schema: schemas.MessageBody },
        409: {
          description:
            "발행한 글이다(주소 잠금) · revision이 맞지 않는다 · 새 주소에 글이 이미 있다 — 어느 쪽도 바뀌지 않는다",
          schema: schemas.MessageBody,
        },
        428: { description: "If-Match가 없다", schema: schemas.MessageBody },
      },
    },
    {
      method: "post",
      path: "/api/preview",
      operationId: "previewPost",
      tag: "posts",
      summary: "미리보기",
      description:
        "공개 API와 같은 렌더러 · imageBaseUrl로 본문을 그린다. 저장하지 않는다. 스타일은 /public/post.css.",
      requiresSession: true,
      requestBody: { description: "그릴 문서", schema: schemas.PreviewBody },
      responses: {
        200: { description: "그린 본문", schema: schemas.PreviewResult },
        400: {
          description: "본문이 JSON이 아니거나 문서가 스키마에 맞지 않는다",
          schema: schemas.SchemaErrorBody,
        },
        401: unauthorized,
      },
    },
    {
      method: "post",
      path: "/api/images",
      operationId: "uploadImage",
      tag: "images",
      summary: "이미지 올리기",
      description:
        "본문은 이미지 바이트. 줄이기와 방향 적용은 브라우저가 하고 서버는 형식 · 크기만 검사한다(ADR-021).",
      requiresSession: true,
      requestBody: { description: "이미지 바이트", mediaTypes: IMAGE_MEDIA_TYPES },
      responses: {
        200: { description: "같은 내용이 이미 있다", schema: schemas.ImageUploadResult },
        201: { description: "새로 저장됨", schema: schemas.ImageUploadResult },
        401: unauthorized,
        413: { description: IMAGE_TOO_LARGE_MESSAGE, schema: schemas.MessageBody },
        415: { description: IMAGE_FORMAT_MESSAGE, schema: schemas.MessageBody },
        422: {
          description: `${IMAGE_TOO_WIDE_MESSAGE} · ${IMAGE_ROTATED_MESSAGE}`,
          schema: schemas.MessageBody,
        },
      },
    },
    {
      method: "get",
      path: "/images/{name}",
      operationId: "getImage",
      tag: "images",
      summary: "올린 이미지 받기",
      description: "로컬 개발용 — 배포에서는 CloudFront가 같은 경로를 준다.",
      requiresSession: false,
      parameters: [
        {
          name: "name",
          in: "path",
          required: true,
          description: "`<해시 32자>.<jpg|png|webp|gif>`",
          schema: z.string(),
        },
      ],
      responses: {
        200: {
          description: "이미지 바이트(nosniff · CSP sandbox · 긴 캐시)",
          contentTypePrefix: "image/",
          mediaTypes: IMAGE_MEDIA_TYPES,
        },
        404: { description: "이름 모양이 틀렸거나 없다", contentType: "text/plain" },
      },
    },
    {
      method: "get",
      path: "/public/posts",
      operationId: "listPublicPosts",
      tag: "public",
      summary: "공개 글 목록(사이트 빌드용)",
      description:
        "발행 글만, 렌더된 HTML 포함. 초안이 섞이면 응답 대신 500이다(public-posts-api).",
      requiresSession: false,
      responses: {
        200: { description: "발행 글", schema: schemas.PublicPosts },
        500: {
          description: "응답이 공개 계약에 맞지 않는다(초안이 섞였다) — Hono 기본 오류 응답",
          contentType: "text/plain",
        },
      },
    },
    {
      method: "get",
      path: "/public/post.css",
      operationId: "getPostCss",
      tag: "public",
      summary: "본문용 CSS",
      requiresSession: false,
      responses: { 200: { description: "본문용 CSS", contentType: "text/css" } },
    },
  ];
}

/**
 * 계약의 원천 표 — 문서(`buildOpenApiDocument`)와 계약 테스트의 응답 검증이 이 표를 쓴다.
 * 카테고리는 워크스페이스 설정이라 인자로 받는다.
 */
export function contractOperations(options: { categories: Categories }): ContractOperation[] {
  return operationsFrom(contractSchemas(options.categories));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON 값 전체를 훑어 바꾼다 — 바꾼 값 안으로는 다시 들어가지 않는다 */
function mapJson(value: unknown, replace: (node: unknown) => unknown): unknown {
  const replaced = replace(value);
  if (replaced !== value) return replaced;
  if (Array.isArray(value)) return value.map((item) => mapJson(item, replace));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, mapJson(item, replace)]),
  );
}

/** JSON Schema 문서 머리(`$schema` · `$id`)를 뗀다 — OpenAPI 컴포넌트에는 자리가 없다 */
function withoutDocumentKeys(schema: unknown): JsonObject {
  if (!isObject(schema)) return {};
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== "$schema" && key !== "$id"),
  );
}

/** 공유 정의는 `type` 상수로 이름을 짓는다(예: listItem → ListItem) — 없으면 zod가 준 이름 */
function sharedName(key: string, schema: unknown): string {
  const typeConst = isObject(schema) && isObject(schema.properties) ? schema.properties.type : null;
  const name = isObject(typeConst) && typeof typeConst.const === "string" ? typeConst.const : key;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * zod가 만든 컴포넌트를 OpenAPI 모양으로 다듬는다 — 문서 머리를 떼고, `__shared#/$defs/x` 참조
 * (OpenAPI 도구가 못 푸는 모양)를 컴포넌트로 끌어올리고, 카테고리 표식을 문자열 규칙으로 바꾼다.
 */
function componentSchemas(schemas: ContractSchemas): JsonObject {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(schemas)) registry.add(schema, { id });
  const generated = z.toJSONSchema(registry, {
    uri: (id) => `${COMPONENTS_PREFIX}${id}`,
    unrepresentable: "any",
  }).schemas;

  const { [ZOD_SHARED_ID]: shared, ...named } = generated;
  const sharedDefs = isObject(shared) && isObject(shared.$defs) ? shared.$defs : {};
  const renamed = new Map(
    Object.entries(sharedDefs).map(([key, schema]) => [key, sharedName(key, schema)]),
  );
  // 끌어올린 이름이 겹치면 참조가 엉뚱한 컴포넌트를 가리키게 된다 — 조용히 덮지 않고 멈춘다
  const taken = new Set(Object.keys(named));
  for (const name of renamed.values()) {
    if (taken.has(name)) throw new Error(`계약 컴포넌트 이름이 겹친다: ${name}`);
    taken.add(name);
  }
  const sharedRefPrefix = `${COMPONENTS_PREFIX}${ZOD_SHARED_ID}#/$defs/`;

  const replace = (node: unknown): unknown => {
    if (!isObject(node)) return node;
    if (typeof node.$ref === "string" && node.$ref.startsWith(sharedRefPrefix)) {
      const key = node.$ref.slice(sharedRefPrefix.length);
      return { ...node, $ref: `${COMPONENTS_PREFIX}${renamed.get(key) ?? key}` };
    }
    if (Array.isArray(node.enum) && node.enum.length === 1 && node.enum[0] === CATEGORY_MARKER) {
      return { type: "string", description: CATEGORY_DESCRIPTION };
    }
    return node;
  };

  const components = Object.fromEntries([
    ...Object.entries(named).map(([id, schema]) => [id, withoutDocumentKeys(schema)]),
    ...Object.entries(sharedDefs).map(([key, schema]) => [renamed.get(key) ?? key, schema]),
  ]);
  return mapJson(components, replace) as JsonObject;
}

/** 이름 붙은 스키마면 참조, 아니면(매개변수 같은 작은 것) 그 자리에 풀어 쓴다 */
function schemaRef(schema: z.ZodType, names: ReadonlyMap<z.ZodType, string>): JsonObject {
  const name = names.get(schema);
  if (name !== undefined) return { $ref: `${COMPONENTS_PREFIX}${name}` };
  return withoutDocumentKeys(z.toJSONSchema(schema, { unrepresentable: "any" }));
}

function contentOf(
  body: Pick<ContractRequestBody, "schema" | "mediaTypes"> & { contentType?: string },
  names: ReadonlyMap<z.ZodType, string>,
): JsonObject | undefined {
  if (body.schema !== undefined) {
    return { [JSON_MEDIA_TYPE]: { schema: schemaRef(body.schema, names) } };
  }
  const mediaTypes = body.mediaTypes ?? (body.contentType === undefined ? [] : [body.contentType]);
  if (mediaTypes.length === 0) return undefined;
  return Object.fromEntries(mediaTypes.map((type) => [type, {}]));
}

function responseOf(response: ContractResponse, names: ReadonlyMap<z.ZodType, string>): JsonObject {
  const content = contentOf(response, names);
  const headers =
    response.headers === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(response.headers).map(([name, description]) => [
            name,
            { description, schema: { type: "string" } },
          ]),
        );
  return {
    description: response.description,
    ...(headers === undefined ? {} : { headers }),
    ...(content === undefined ? {} : { content }),
  };
}

function operationOf(op: ContractOperation, names: ReadonlyMap<z.ZodType, string>): JsonObject {
  const parameters = op.parameters?.map((parameter) => ({
    name: parameter.name,
    in: parameter.in,
    required: parameter.required,
    description: parameter.description,
    schema:
      parameter.schema === undefined ? { type: "string" } : schemaRef(parameter.schema, names),
  }));
  const requestContent =
    op.requestBody === undefined ? undefined : contentOf(op.requestBody, names);
  return {
    operationId: op.operationId,
    tags: [op.tag],
    summary: op.summary,
    ...(op.description === undefined ? {} : { description: op.description }),
    security: op.requiresSession ? [{ [SESSION_SCHEME]: [] }] : [],
    ...(parameters === undefined ? {} : { parameters }),
    ...(op.requestBody === undefined || requestContent === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            description: op.requestBody.description,
            content: requestContent,
          },
        }),
    responses: Object.fromEntries(
      Object.entries(op.responses).map(([status, response]) => [
        status,
        responseOf(response, names),
      ]),
    ),
  };
}

/** `/api` 계약 문서(OpenAPI 3.1) — `api/openapi.json`은 이 값을 그대로 쓴 것이다 */
export function buildOpenApiDocument(): JsonObject {
  const schemas = contractSchemas([CATEGORY_MARKER]);
  const names = new Map<z.ZodType, string>(
    Object.entries(schemas).map(([name, schema]) => [schema, name]),
  );
  const paths: Record<string, JsonObject> = {};
  for (const op of operationsFrom(schemas)) {
    paths[op.path] = { ...paths[op.path], [op.method]: operationOf(op, names) };
  }
  return {
    openapi: OPENAPI_VERSION,
    info: { title: "blog-editor API", version: API_VERSION, description: API_DESCRIPTION },
    paths,
    components: {
      securitySchemes: {
        [SESSION_SCHEME]: { type: "apiKey", in: "cookie", name: SESSION_COOKIE_NAME },
      },
      schemas: componentSchemas(schemas),
    },
  };
}
