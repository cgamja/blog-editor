import { imagePathSchema } from "@blog-editor/content-schema";
import { createApp } from "./app";
import { createMemoryImageStore } from "./memory-image-store";
import { createMemoryPostStore } from "./memory-store";
import {
  exifApp1,
  jpegFrom,
  jpegWithOrientationBytes,
  pngBytes,
  sof0,
  sos,
  svgBytes,
} from "./images.test.helpers";
import { testAuthOptions, withSession } from "./test-app.test.helpers";

const MIB = 1024 * 1024;

function setup() {
  const images = createMemoryImageStore();
  const app = createApp({
    store: createMemoryPostStore(),
    categories: ["studio"],
    imageBaseUrl: "https://example.com",
    images,
    ...testAuthOptions,
  });
  return { app, images, client: withSession(app) };
}

const upload = (bytes: Uint8Array) => ({ method: "POST", body: bytes });

describe("POST /api/images", () => {
  it("WHEN 세션 쿠키 없이 PNG를 올리면 THEN 401이고 저장소에 아무것도 없다", async () => {
    const { app, images } = setup();
    const res = await app.request("/api/images", upload(pngBytes(800, 600)));
    expect(res.status).toBe(401);
    expect(await images.count()).toBe(0);
  });

  it("WHEN 800×600 PNG를 두 번 올리면 THEN 201 뒤 200이고 같은 경로 · 원본 크기다", async () => {
    const { client } = setup();
    const first = await client.request("/api/images", upload(pngBytes(800, 600)));
    const second = await client.request("/api/images", upload(pngBytes(800, 600)));
    expect([first.status, second.status]).toEqual([201, 200]);
    const a = (await first.json()) as { path: string; naturalWidth: number; naturalHeight: number };
    const b = (await second.json()) as { path: string };
    expect(b.path).toBe(a.path);
    expect(imagePathSchema.safeParse(a.path).success).toBe(true);
    expect(a.path).toMatch(/^\/images\/[0-9a-f]{32}\.png$/);
    expect([a.naturalWidth, a.naturalHeight]).toEqual([800, 600]);
  });

  it("WHEN SVG · 1 MiB 넘는 PNG · 1601×10 PNG를 올리면 THEN 415 · 413 · 422이고 저장하지 않는다", async () => {
    const { client, images } = setup();
    const svg = await client.request("/api/images", upload(svgBytes()));
    const big = await client.request("/api/images", upload(pngBytes(100, 100, MIB)));
    const wide = await client.request("/api/images", upload(pngBytes(1601, 10)));
    expect([svg.status, big.status, wide.status]).toEqual([415, 413, 422]);
    expect(await images.count()).toBe(0);
  });

  it("WHEN EXIF Orientation 6인 JPEG를 올리면 THEN 422이고 저장하지 않는다", async () => {
    const { client, images } = setup();
    const res = await client.request("/api/images", upload(jpegWithOrientationBytes(640, 480, 6)));
    const afterSof = await client.request(
      "/api/images",
      upload(jpegFrom(sof0(640, 480), exifApp1(6), sos())),
    );
    expect([res.status, afterSof.status]).toEqual([422, 422]);
    expect(await images.count()).toBe(0);
  });

  it("WHEN EXIF Orientation 1~4인 JPEG를 올리면 THEN 201로 저장된다", async () => {
    const { client } = setup();
    for (const orientation of [1, 2, 3, 4]) {
      const res = await client.request(
        "/api/images",
        upload(jpegWithOrientationBytes(640, 480, orientation)),
      );
      expect(res.status).toBe(201);
    }
  });
});

describe("GET /images/:name", () => {
  it("WHEN 올린 PNG의 path로 GET하면 THEN 같은 바이트 · image/png · nosniff · CSP · CORP · immutable이다", async () => {
    const { app, client } = setup();
    const bytes = pngBytes(800, 600);
    const { path } = (await (await client.request("/api/images", upload(bytes))).json()) as {
      path: string;
    };
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-site");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("WHEN 모양이 아닌 이름 · 없는 이미지를 GET하면 THEN 모두 404다", async () => {
    const { app } = setup();
    const missing = `/images/${"a".repeat(32)}.png`;
    for (const path of ["/images/..%2Fsecret.png", "/images/abc.svg", missing]) {
      expect((await app.request(path)).status).toBe(404);
    }
  });
});
