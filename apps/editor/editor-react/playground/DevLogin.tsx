import { useState } from "react";
import type { FormEvent } from "react";
import { devMessages } from "./messages";

/** 로컬 API 세션(POST /api/session) — 이미지 올리기를 플레이그라운드에서 확인하려고. 로그인 화면은 M3 */
const SESSION_ENDPOINT = "/api/session";

export function DevLogin() {
  const [status, setStatus] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    setStatus(response.ok ? devMessages.loggedIn : devMessages.loginFailed(response.status));
  };

  return (
    <form className="playground-login" aria-label={devMessages.loginLabel} onSubmit={onSubmit}>
      <label>
        {devMessages.username} <input name="username" autoComplete="username" />
      </label>
      <label>
        {devMessages.password}{" "}
        <input name="password" type="password" autoComplete="current-password" />
      </label>
      <button type="submit">{devMessages.login}</button>
      <span role="status">{status}</span>
    </form>
  );
}
