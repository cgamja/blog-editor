import {
  ALLOW_LABEL,
  CONSENT_LEAD,
  DENY_LABEL,
  LOOPBACK_WARNING,
  PAGE_TITLE,
  PASSWORD_LABEL,
  REDIRECT_LABEL,
  USERNAME_LABEL,
} from "./messages";

/**
 * 로그인 · 동의 화면 — 서버가 그리는 최소 HTML(스크립트 없음). 에디터 화면(M3)이 생겨도 이 흐름은
 * 인가 서버 쪽에 남는다. 클릭재킹은 응답 헤더(frame-ancestors)가 막는다.
 */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

const STYLE = `body{margin:0;background:#fbf6ef;color:#3a2b26;font:15px/1.6 system-ui,sans-serif}
main{max-width:420px;margin:48px auto;padding:28px 24px;background:#fff;border:1px solid #e4d9cf;border-radius:14px}
h1{font-size:1.4rem;margin:0 0 12px}p{margin:0 0 12px}.redirect{font-family:ui-monospace,monospace;font-size:13px;word-break:break-all}
.warn,.error{background:#fff1cc;padding:10px 12px;border-radius:8px}.error{background:#ffede6;color:#a3341f}
label{display:block;margin:12px 0 4px;font-weight:600}input[type=text],input[type=password]{width:100%;box-sizing:border-box;height:44px;padding:0 12px;border:1px solid #e4d9cf;border-radius:8px;font:inherit}
.actions{display:flex;gap:8px;margin-top:20px}button{flex:1;height:44px;border-radius:10px;border:1px solid #e4d9cf;font:inherit;cursor:pointer;background:#fff}
button[value=allow]{background:#b0552f;border-color:#b0552f;color:#fff}button:focus-visible,input:focus-visible{outline:2px solid #b0552f;outline-offset:2px}`;

function layout(body: string): string {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${PAGE_TITLE}</title><style>${STYLE}</style><main>${body}</main></html>`;
}

export interface ConsentPageInput {
  clientName: string;
  redirectUri: string;
  loopback: boolean;
  /** POST에서 다시 검증할 인가 요청 값 */
  request: Readonly<Record<string, string>>;
  /** 세션 쿠키가 없으면 아이디 · 비밀번호 칸을 보인다 */
  needsLogin: boolean;
  errorMessage?: string;
}

export function consentPage(input: ConsentPageInput): string {
  const hidden = Object.entries(input.request)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("");
  const login = input.needsLogin
    ? `<label for="username">${USERNAME_LABEL}</label><input id="username" name="username" type="text" autocomplete="username" required>` +
      `<label for="password">${PASSWORD_LABEL}</label><input id="password" name="password" type="password" autocomplete="current-password" required>`
    : "";
  const error =
    input.errorMessage === undefined
      ? ""
      : `<p class="error" role="alert">${escapeHtml(input.errorMessage)}</p>`;
  const warning = input.loopback ? `<p class="warn">${LOOPBACK_WARNING}</p>` : "";
  return layout(
    `<h1>${escapeHtml(input.clientName)}</h1>${error}<p>${CONSENT_LEAD}</p>` +
      `<p>${REDIRECT_LABEL}: <span class="redirect">${escapeHtml(input.redirectUri)}</span></p>${warning}` +
      `<form method="post" action="/authorize">${hidden}${login}` +
      `<div class="actions"><button type="submit" name="decision" value="deny" formnovalidate>${DENY_LABEL}</button>` +
      `<button type="submit" name="decision" value="allow">${ALLOW_LABEL}</button></div></form>`,
  );
}

export function errorPage(message: string): string {
  return layout(`<h1>${PAGE_TITLE}</h1><p class="error" role="alert">${escapeHtml(message)}</p>`);
}
