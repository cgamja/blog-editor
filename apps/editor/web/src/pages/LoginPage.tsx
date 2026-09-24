import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError, login } from "../api/client";
import { MESSAGES } from "../messages";
import { SESSION_QUERY_KEY } from "../query-client";
import { NEXT_PARAM, safeNextPath } from "../routes";

function loginErrorMessage(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError && error.userMessage !== null) return error.userMessage;
  return MESSAGES.login.failed;
}

/**
 * 최소 로그인 폼 — 가드의 흐름(로그인 → next로 복귀)을 세우기 위한 것이다. 화면 디자인은 로그인 화면 이슈가 채운다.
 * API 거절 문장(잠금 · 틀린 비밀번호)은 그대로 보여 준다.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const submit = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      navigate(safeNextPath(searchParams.get(NEXT_PARAM)), { replace: true });
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit.mutate();
  };

  const errorMessage = loginErrorMessage(submit.error);

  return (
    <main className="app-page app-login">
      <h1>{MESSAGES.login.title}</h1>
      <form onSubmit={onSubmit} aria-describedby={errorMessage === null ? undefined : errorId}>
        <label htmlFor={usernameId}>{MESSAGES.login.username}</label>
        <input
          id={usernameId}
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <label htmlFor={passwordId}>{MESSAGES.login.password}</label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {errorMessage === null ? null : (
          <p id={errorId} className="app-error" role="alert">
            {errorMessage}
          </p>
        )}
        <button type="submit" disabled={submit.isPending}>
          {submit.isPending ? MESSAGES.login.submitting : MESSAGES.login.submit}
        </button>
      </form>
    </main>
  );
}
