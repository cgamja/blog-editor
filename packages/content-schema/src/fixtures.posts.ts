import type { PostFile } from "./post-file";
import { SCHEMA_VERSION } from "./meta";

/**
 * 4.2 — render(#6) · convert · API(M1) · 사이트(#8) · Lighthouse 기준선이 같이 쓰는 대표 문서 3개
 * (spec: document-fixtures). 이미 정규형으로 작성한다 — normalize(doc)가 doc과 deep-equal해야
 * 하므로 marks/attrs 빈 값을 만들지 않고, marks는 bold < code < italic < link 순으로,
 * 같은 마크의 인접 text는 미리 하나로 합쳐서 쓴다(fixtures.test.ts가 그대로 검증한다).
 */

// ── minimal — 문단 하나 ────────────────────────────────────────────────

export const minimal = {
  schemaVersion: SCHEMA_VERSION,
  meta: {
    title: "육아비서 앱 베타 오픈 안내",
    description:
      "심심이스튜디오가 만든 육아비서 앱의 베타 테스트를 시작합니다. 신청 방법과 일정을 안내합니다.",
    date: "2026-01-15",
    category: "studio",
    draft: true,
    source: "editor",
  },
  doc: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "심심이스튜디오는 오늘부터 육아비서 앱의 베타 테스트 신청을 받습니다. 관심 있는 보호자분들은 홈페이지에서 신청해 주세요.",
          },
        ],
      },
    ],
  },
} satisfies PostFile;

// ── allBlocks — 모든 블록 · 모든 마크를 한 번씩 ─────────────────────────

export const allBlocks = {
  schemaVersion: SCHEMA_VERSION,
  meta: {
    title: "육아비서 기능 전체 둘러보기",
    description: "육아비서 앱이 제공하는 기록, 일정, AI 도우미 기능을 화면과 함께 소개합니다.",
    date: "2026-02-03",
    category: "parenting-assistant",
    draft: true,
    image: "/images/parenting-assistant-cover.webp",
    source: "editor",
  },
  doc: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "육아비서는 " },
          { type: "text", text: "보호자", marks: [{ type: "bold" }] },
          { type: "text", text: "와 아이를 함께 챙기는 AI 육아 도우미입니다. " },
          { type: "text", text: "지금 바로 무료로 체험해보세요.", marks: [{ type: "italic" }] },
          { type: "text", text: " 설정은 " },
          { type: "text", text: "config.json", marks: [{ type: "code" }] },
          { type: "text", text: " 파일에서 관리하고, 전체 안내는 " },
          {
            type: "text",
            text: "공식 문서",
            marks: [
              {
                type: "link",
                attrs: { href: "https://simsimeestudio.com/blog/parenting-assistant-guide" },
              },
            ],
          },
          { type: "text", text: "에서, 도입 문의는 " },
          {
            type: "text",
            text: "이메일",
            marks: [{ type: "link", attrs: { href: "mailto:hello@simsimeestudio.com" } }],
          },
          { type: "text", text: "로, 앱 소개 페이지는 " },
          {
            type: "text",
            text: "여기",
            marks: [{ type: "link", attrs: { href: "/apps/parenting-assistant" } }],
          },
          { type: "text", text: "에서 확인할 수 있습니다." },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "육아비서 앱 소개" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "이 글에서는 육아비서 앱이 제공하는 주요 화면과 기능을 순서대로 살펴봅니다.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "주요 기능" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "아이 성장 기록을 사진과 함께 저장합니다." }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "예방접종과 병원 일정을 자동으로 알려줍니다." }],
              },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "앱을 설치하고 계정을 만듭니다." }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "아이 프로필을 등록한 뒤 아래 항목을 채웁니다.",
                  },
                ],
              },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "이름과 생년월일" }],
                      },
                    ],
                  },
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "특이사항이나 알레르기 정보" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: '"육아비서 덕분에 예방접종 일정을 놓친 적이 없어요." — 베타 테스터 후기',
              },
            ],
          },
        ],
      },
      {
        type: "codeBlock",
        attrs: { language: "typescript" },
        content: [
          {
            type: "text",
            text: "type Reminder = {\n  title: string;\n  dueDate: string;\n};",
          },
        ],
      },
      { type: "horizontalRule" },
      {
        type: "image",
        attrs: {
          src: "/images/parenting-assistant-dashboard.webp",
          naturalWidth: 1600,
          naturalHeight: 1000,
          alt: "육아비서 앱 대시보드에서 아이 성장 기록을 보여주는 화면",
        },
      },
      {
        type: "callout",
        attrs: { tone: "tip" },
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "알림 설정에서 예방접종 주기를 직접 조정할 수 있습니다.",
              },
            ],
          },
        ],
      },
      {
        type: "appScreenshot",
        attrs: {
          src: "/images/parenting-assistant-schedule-screen.webp",
          naturalWidth: 738,
          naturalHeight: 1600,
          caption: "일정 탭에서 다가오는 예방접종을 확인하는 화면",
        },
      },
    ],
  },
} satisfies PostFile;

// ── decorationMax — Lighthouse 기준선(글씨체 3종 · 움직임 · 폭 · 스티커 12개) ──

export const decorationMax = {
  schemaVersion: SCHEMA_VERSION,
  meta: {
    title: "라이트하우스 기준선: 육아비서 신규 알림 기능",
    description:
      "육아비서 앱의 새 알림 기능을 소개하며 에디터의 폰트·움직임·스티커 꾸미기를 모두 사용한 성능 기준 글입니다.",
    date: "2026-03-10",
    category: "parenting-assistant",
    draft: true,
    image: "/images/parenting-assistant-notification-cover.webp",
    source: "editor",
  },
  doc: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: {
          font: "pretendard",
          motion: "fade-in",
          stickers: [
            { id: "star-coral", x: -25, y: 0, size: 5, rotate: -180 },
            { id: "heart", x: 50, y: 30, size: 20, rotate: 0 },
          ],
        },
        content: [
          {
            type: "text",
            text: "육아비서 앱에 새로운 알림 기능이 추가되었습니다. 이번 업데이트로 예방접종부터 수유 시간까지 한 곳에서 챙길 수 있습니다.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2, font: "jua", motion: "fade-up" },
        content: [{ type: "text", text: "라이트하우스 성능 기준선" }],
      },
      {
        type: "paragraph",
        attrs: { font: "gaegu" },
        content: [
          {
            type: "text",
            text: "이 글은 폰트·움직임·스티커를 모두 사용해 렌더링 성능을 측정하는 기준 문서입니다.",
          },
        ],
      },
      {
        type: "paragraph",
        attrs: {
          motion: "slide-left",
          stickers: [{ id: "cloud", x: 125, y: 125, size: 50, rotate: 180 }],
        },
        content: [
          {
            type: "text",
            text: "알림은 보호자가 설정한 시간에 맞춰 정확히 도착합니다.",
          },
        ],
      },
      {
        type: "bulletList",
        attrs: {
          font: "pretendard",
          motion: "pop",
          stickers: [{ id: "bottle", x: 10, y: -25, size: 15, rotate: 45 }],
        },
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "수유·기저귀·수면 기록에 맞춘 알림" }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "예방접종 일정 자동 알림" }],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "스티커와 폰트 조합" }],
      },
      {
        type: "orderedList",
        attrs: { motion: "slide-right" },
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "설정 화면에서 알림을 켭니다." }],
              },
            ],
          },
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "원하는 시간과 반복 주기를 고릅니다." }],
              },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        attrs: { font: "jua" },
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: '"알림 덕분에 밤중 수유 시간을 놓치지 않게 됐어요." — 베타 테스터 후기',
              },
            ],
          },
        ],
      },
      {
        type: "image",
        attrs: {
          src: "/images/parenting-assistant-notification-list.webp",
          naturalWidth: 1600,
          naturalHeight: 1200,
          alt: "육아비서 앱의 알림 목록 화면",
          motion: "fade-in",
          width: 60,
          stickers: [
            { id: "rattle", x: 0, y: 0, size: 30, rotate: -90 },
            { id: "pacifier", x: 100, y: 100, size: 25, rotate: 90 },
          ],
        },
      },
      {
        type: "appScreenshot",
        attrs: {
          src: "/images/parenting-assistant-notification-detail.webp",
          naturalWidth: 738,
          naturalHeight: 1600,
          caption: "알림 상세 설정 화면",
          motion: "fade-up",
          width: 80,
          stickers: [
            { id: "foot-coral", x: -10, y: 110, size: 12, rotate: -45 },
            { id: "foot-mint", x: 110, y: -10, size: 40, rotate: 135 },
          ],
        },
      },
      {
        type: "codeBlock",
        attrs: { language: "json", motion: "pop" },
        content: [
          {
            type: "text",
            text: '{\n  "notification": {\n    "type": "feeding",\n    "repeat": "daily"\n  }\n}',
          },
        ],
      },
      { type: "horizontalRule", attrs: { motion: "slide-left" } },
      {
        type: "callout",
        attrs: {
          tone: "note",
          font: "gaegu",
          stickers: [{ id: "star-mint", x: 60, y: 60, size: 8, rotate: -120 }],
        },
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "알림 시간은 언제든 설정에서 바꿀 수 있습니다.",
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        attrs: {
          motion: "fade-in",
          stickers: [
            { id: "star-coral", x: 5, y: 5, size: 5, rotate: 0 },
            { id: "heart", x: 95, y: 95, size: 45, rotate: 170 },
            { id: "cloud", x: -20, y: 115, size: 33, rotate: -30 },
          ],
        },
        content: [
          {
            type: "text",
            text: "육아비서 알림 기능은 이번 주부터 순차적으로 배포됩니다. 업데이트 후 설정에서 알림을 켜보세요.",
          },
        ],
      },
    ],
  },
} satisfies PostFile;
