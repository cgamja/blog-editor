import type { PostFile } from "./post-file";

/** 4.2에서 채운다 — render · convert · API · 사이트 · Lighthouse 기준선이 같이 쓰는 대표 문서 3개. */
export type Fixtures = {
  minimal: PostFile;
  allBlocks: PostFile;
  decorationMax: PostFile;
};

export type InvalidFixture = { name: string; file: unknown; reason: string };

function notImplemented(key: string): never {
  throw new Error(`fixtures.${key}: 기능 미구현`);
}

/**
 * 4.2 이전에는 값이 없다. 접근하는 순간(모듈 로드 시점이 아니라) 던지도록 getter로 둬서
 * 각 테스트가 "기능 미구현"으로 빨강이 되게 한다 — import 자체는 실패하지 않는다.
 */
export const fixtures: Fixtures = {
  get minimal(): PostFile {
    return notImplemented("minimal");
  },
  get allBlocks(): PostFile {
    return notImplemented("allBlocks");
  },
  get decorationMax(): PostFile {
    return notImplemented("decorationMax");
  },
} as unknown as Fixtures;

/**
 * javascript-link · absolute-image · unknown-attr · too-many-stickers · future-version —
 * 4.2에서 채운다. 배열의 어떤 속성에 접근해도(length · 인덱스 · 순회) 던지도록 Proxy를 쓴다.
 */
export const invalidFixtures: ReadonlyArray<InvalidFixture> = new Proxy([] as InvalidFixture[], {
  get(_target, prop) {
    throw new Error(`invalidFixtures: 기능 미구현 (접근: ${String(prop)})`);
  },
}) as ReadonlyArray<InvalidFixture>;
