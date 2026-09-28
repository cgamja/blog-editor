import { readFile } from "node:fs/promises";
import type { Browser, BrowserContext, Page, Route } from "playwright-core";
import { STICKER_IDS } from "@blog-editor/content-schema";
import { isImageName } from "../image-store";
import type { ImageStore } from "../image-store";
import type { ImageExtension } from "../image-types";
import { CONTENT_TYPE_OF } from "../images";
import { PREVIEW_WIDTHS } from "./constants";
import { previewSliceAt, previewSlices } from "./preview-slices";
import type { PreviewSlice } from "./preview-slices";

export type PreviewWidth = keyof typeof PREVIEW_WIDTHS;
const PREVIEW_ORDER: readonly PreviewWidth[] = ["desktop", "mobile"];
/** 처음 뷰포트 높이 — 찍는 것은 전체 페이지를 구간으로 자른 것이라 값이 결과를 바꾸지 않는다(디자인 기준 높이) */
const INITIAL_VIEWPORT_HEIGHT = 860;
/** JPEG 품질 — 토큰 수는 픽셀 크기가 정하고(ADR-042) 이 값은 응답 바이트만 바꾼다. 70이면 본문 글자가 또렷하다(로컬 실측) */
const PREVIEW_JPEG_QUALITY = 70;
/** 브라우저 띄우기 상한 — 로컬 headless shell은 수백 ms 안에 뜬다(실측 약 70ms). 넘으면 멈춘 것이다 */
const BROWSER_LAUNCH_TIMEOUT_MS = 30_000;
/** 문서 넣기 · 한 장 찍기 상한 */
const PAGE_TIMEOUT_MS = 15_000;
/** 바깥 자원(Google Fonts · 사이트 이미지) 기다리기 상한 — 네트워크가 없어도 글꼴 없이 찍어서 돌려준다 */
const ASSET_WAIT_MS = 5_000;
/**
 * 동시에 찍는 수 — 한 번에 Chromium 하나(페이지 둘)만 띄운다. 로컬 한 사람용 서버라 줄을 세워도 느려지지 않고,
 * AI가 여러 글을 한꺼번에 부를 때 브라우저가 겹쳐 떠 메모리를 잡아먹지 않게 한다.
 */
const MAX_CONCURRENT_CAPTURES = 1;
/** playwright-core가 브라우저 실행 파일을 못 찾을 때의 오류 문장(lib/coreBundle.js "Executable doesn't exist at …") */
const EXECUTABLE_MISSING = /executable doesn't exist/i;
/** 허용 목록 밖으로 나가는 요청 — 미리보기 문서는 글꼴 · 이미지 · 스티커 말고는 부를 것이 없다 */
const FONT_HOSTS: ReadonlySet<string> = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

/*
 * 페이지 안에서 도는 식 — api tsconfig에 DOM 타입이 없어(node 서버) 함수가 아니라 문자열로 넘긴다.
 * page.evaluate는 식이 Promise면 기다린다(playwright-core types.d.ts `evaluate`). 페이지 스크립트는 꺼 두지만
 * (javaScriptEnabled: false) evaluate는 돈다 — 대신 페이지 안 타이머가 돌지 않아 기다림 상한은 Node 쪽에서 건다(실측).
 */
const EAGER_IMAGES_SCRIPT = `for (const img of document.images) img.loading = "eager";`;
const WAIT_ASSETS_SCRIPT = `Promise.all([
  document.fonts.ready,
  ...Array.from(document.images, (img) => img.decode().catch(() => {})),
]).then(() => true)`;
/** 문서 루트(html)의 높이는 뷰포트보다 작아지지 않아 짧은 글에 빈 여백이 붙는다 — 넘친 스티커까지 담는 body 높이를 잰다 */
const PAGE_HEIGHT_SCRIPT = "Math.ceil(document.body.scrollHeight)";

const STICKER_FILES: ReadonlySet<string> = new Set(STICKER_IDS.map((id) => `${id}.png`));
const STICKERS_PREFIX = "/stickers/";
const IMAGES_PREFIX = "/images/";

export interface PreviewAssets {
  /** 렌더러가 이미지 · 스티커 주소 앞에 붙인 주소 — 그 아래 요청을 로컬에서 답한다 */
  imageBaseUrl: string;
  /** 올린 이미지 저장소(ADR-021) — 초안의 이미지는 아직 사이트에 없어 여기서 읽는다. 없으면 사이트로 간다 */
  images?: ImageStore;
}

export interface CaptureOptions {
  /** 브라우저 띄우기 — 기본은 로컬 설치본 Chromium. 테스트가 "실행 파일 없음"을 재현하려고 바꾼다 */
  launch?: () => Promise<Browser>;
}

export type PreviewCapture =
  | {
      ok: true;
      parts: Record<PreviewWidth, number>;
      /** part번째 구간 JPEG — 그 폭의 구간이 이미 끝났으면 null */
      images: Record<PreviewWidth, Buffer | null>;
    }
  | { ok: false; reason: "browserMissing" }
  | { ok: false; reason: "partOutOfRange"; parts: Record<PreviewWidth, number> };

class BrowserMissingError extends Error {}

async function launchChromium(): Promise<Browser> {
  // 부를 때만 불러온다 — 미리보기를 쓰지 않는 서버 시작 · 테스트가 playwright-core를 읽지 않는다
  const { chromium } = await import("playwright-core");
  return chromium.launch({ timeout: BROWSER_LAUNCH_TIMEOUT_MS });
}

let activeCaptures = 0;
const waitingCaptures: Array<() => void> = [];

/** 동시 찍기를 MAX_CONCURRENT_CAPTURES로 묶는다. 끝난 자리는 기다리던 호출에 바로 넘겨 새로 온 호출이 끼어들지 못한다 */
async function withCaptureSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeCaptures < MAX_CONCURRENT_CAPTURES) activeCaptures += 1;
  else await new Promise<void>((resolve) => waitingCaptures.push(resolve));
  try {
    return await run();
  } finally {
    const next = waitingCaptures.shift();
    if (next === undefined) activeCaptures -= 1;
    else next();
  }
}

/** 상한 안에서만 기다린다 — 실패해도 · 시간이 넘어도 그냥 넘어간다(글꼴 · 이미지 없이 찍는다) */
async function waitAtMost(promise: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([promise.then(ignore, ignore), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function ignore(): void {}

/**
 * 호출마다 브라우저를 띄우고 닫는다 — 띄우기가 수십~수백 ms라 재사용으로 아낄 것이 적고, 재사용하면 유휴 닫기 ·
 * 서버 종료 정리 · 죽은 브라우저 복구를 따로 들고 가야 한다. 끝나면 finally에서 닫으므로 서버가 내려갈 때 남는 것이 없다.
 */
async function withBrowserContext<T>(
  run: (context: BrowserContext) => Promise<T>,
  assets: PreviewAssets,
  launch: () => Promise<Browser>,
): Promise<T> {
  const browser = await launch().catch((error: unknown) => {
    if (error instanceof Error && EXECUTABLE_MISSING.test(error.message)) {
      throw new BrowserMissingError(error.message);
    }
    throw error;
  });
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      deviceScaleFactor: 1,
      colorScheme: "light",
      locale: "ko-KR",
      // 렌더러 HTML에는 스크립트가 없다 — 글 속 무엇도 페이지에서 실행되지 않게 끈다
      javaScriptEnabled: false,
      viewport: { width: PREVIEW_WIDTHS.desktop, height: INITIAL_VIEWPORT_HEIGHT },
    });
    await routeAllowedRequests(context, assets);
    return await run(context);
  } finally {
    // 닫히는 중에 도는 가로채기 핸들러의 오류를 버린다(playwright-core `unrouteAll` behavior 'ignoreErrors')
    await context?.unrouteAll({ behavior: "ignoreErrors" }).catch(ignore);
    await browser.close();
  }
}

/**
 * 모든 요청을 가로채 허용 목록만 보낸다: 글꼴(Google Fonts)은 그대로, `imageBaseUrl` 아래는 스티커 · 올린 이미지를
 * 로컬에서 답하고(초안의 이미지는 아직 사이트에 없고, 스티커는 네트워크 없이도 보여야 겹침을 본다) 나머지는 사이트로,
 * 그 밖은 막는다. 핸들러 안의 예외(저장소 읽기 실패 등)는 그 요청만 실패시키고 삼킨다 — 새면 처리되지 않은 거부로
 * api 프로세스가 죽는다.
 */
async function routeAllowedRequests(context: BrowserContext, assets: PreviewAssets): Promise<void> {
  const base = assets.imageBaseUrl.replace(/\/$/, "");
  await context.route("**/*", async (route: Route) => {
    try {
      await answerRequest(route, base, assets.images);
    } catch (error) {
      console.error("mcp: 미리보기 자원 요청 실패", error);
      await route.abort().catch(ignore);
    }
  });
}

async function answerRequest(route: Route, base: string, images: ImageStore | undefined) {
  const href = route.request().url();
  if (href.startsWith(`${base}/`)) {
    const path = href.slice(base.length).split(/[?#]/)[0] ?? "";
    const body = await localAssetOf(path, images);
    if (body === null) return route.continue();
    return route.fulfill({ status: 200, contentType: body.contentType, body: body.bytes });
  }
  if (FONT_HOSTS.has(new URL(href).hostname)) return route.continue();
  return route.abort("blockedbyclient");
}

async function localAssetOf(
  path: string,
  images: ImageStore | undefined,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (path.startsWith(STICKERS_PREFIX)) {
    const name = path.slice(STICKERS_PREFIX.length);
    if (!STICKER_FILES.has(name)) return null;
    // 스티커 원본(content-render `stickers/*` — 사이트 `public/stickers`와 같은 파일)
    const file = new URL(import.meta.resolve(`@blog-editor/content-render/stickers/${name}`));
    return { bytes: await readFile(file), contentType: "image/png" };
  }
  if (path.startsWith(IMAGES_PREFIX) && images !== undefined) {
    const name = path.slice(IMAGES_PREFIX.length);
    if (!isImageName(name)) return null;
    const bytes = await images.get(name);
    if (bytes === null) return null;
    const extension = name.slice(name.lastIndexOf(".") + 1) as ImageExtension;
    return { bytes: Buffer.from(bytes), contentType: CONTENT_TYPE_OF[extension] };
  }
  return null;
}

/**
 * 문서를 넣고 글꼴 · 이미지를 상한 안에서 기다린 뒤 전체 높이를 잰다. 렌더러의 이미지는 `loading="lazy"`라
 * 뷰포트 밖이면 받지 않으므로 먼저 즉시 받기로 바꾼다. 글꼴은 스타일시트가 온 뒤에야 요청되므로 load 다음에 기다린다.
 */
async function openPage(context: BrowserContext, html: string, width: number): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: INITIAL_VIEWPORT_HEIGHT });
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
  await page.evaluate(EAGER_IMAGES_SCRIPT);
  await page.waitForLoadState("load", { timeout: ASSET_WAIT_MS }).catch(ignore);
  await waitAtMost(page.evaluate(WAIT_ASSETS_SCRIPT), ASSET_WAIT_MS);
  return page;
}

async function pageHeightOf(page: Page): Promise<number> {
  return Number(await page.evaluate(PAGE_HEIGHT_SCRIPT));
}

/** 전체 페이지 기준 좌표로 한 구간을 찍는다(`fullPage` + `clip`). 움직이는 꾸밈은 끝난 모양으로 멈춘다 */
async function shoot(page: Page, width: number, slice: PreviewSlice): Promise<Buffer> {
  return page.screenshot({
    type: "jpeg",
    quality: PREVIEW_JPEG_QUALITY,
    fullPage: true,
    clip: { x: 0, y: slice.y, width, height: slice.height },
    scale: "css",
    animations: "disabled",
    timeout: PAGE_TIMEOUT_MS,
  });
}

/**
 * 미리보기 문서를 데스크톱 · 모바일 폭에서 찍어 part(1부터)번째 구간을 돌려준다. 두 폭 모두 구간이 끝난 part면
 * 찍지 않고 전체 구간 수를 알린다.
 */
export async function capturePreview(
  html: string,
  part: number,
  assets: PreviewAssets,
  options: CaptureOptions = {},
): Promise<PreviewCapture> {
  try {
    return await withCaptureSlot(() => captureInBrowser(html, part, assets, options));
  } catch (error) {
    if (error instanceof BrowserMissingError) return { ok: false, reason: "browserMissing" };
    throw error;
  }
}

function captureInBrowser(
  html: string,
  part: number,
  assets: PreviewAssets,
  options: CaptureOptions,
): Promise<PreviewCapture> {
  return withBrowserContext(
    async (context) => {
      const pages = {
        desktop: await openPage(context, html, PREVIEW_WIDTHS.desktop),
        mobile: await openPage(context, html, PREVIEW_WIDTHS.mobile),
      };
      const heights = {
        desktop: await pageHeightOf(pages.desktop),
        mobile: await pageHeightOf(pages.mobile),
      };
      const parts = {
        desktop: previewSlices(heights.desktop).length,
        mobile: previewSlices(heights.mobile).length,
      };
      if (part > Math.max(parts.desktop, parts.mobile)) {
        return { ok: false, reason: "partOutOfRange", parts } as const;
      }
      const images: Record<PreviewWidth, Buffer | null> = { desktop: null, mobile: null };
      for (const width of PREVIEW_ORDER) {
        const slice = previewSliceAt(heights[width], part);
        if (slice !== null) images[width] = await shoot(pages[width], PREVIEW_WIDTHS[width], slice);
      }
      return { ok: true, parts, images } as const;
    },
    assets,
    options.launch ?? launchChromium,
  );
}
