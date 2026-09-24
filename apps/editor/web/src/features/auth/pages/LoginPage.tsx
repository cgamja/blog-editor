import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../../../shared/api/errors";
import { MESSAGES } from "../../../shared/messages";
import { NEXT_PARAM } from "../../../shared/routes/constants";
import { safeNextPath } from "../../../shared/routes/next-path";
import { login } from "../api";
import { markSignedIn } from "../session-cache";

function loginErrorMessage(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError && error.userMessage !== null) return error.userMessage;
  return MESSAGES.login.failed;
}

/**
 * 최소 로그인 폼 — 가드의 흐름(로그인 → next로 복귀)을 세우기 위한 것이다. 화면 디자인은 로그인 화면 이슈가 채운다.
 * API 거절 문장(잠금 · 틀린 비밀번호)은 그대로 보여 주고, 실패하면 첫 입력칸으로 포커스를 옮긴다.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const submit = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: () => {
      markSignedIn(queryClient);
      navigate(safeNextPath(searchParams.get(NEXT_PARAM)), { replace: true });
    },
    onError: () => usernameRef.current?.focus(),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit.mutate();
  };

  const errorMessage = loginErrorMessage(submit.error);
  const hasError = errorMessage !== null;
  const describedBy = hasError ? errorId : undefined;

  return (
    <main className="app-page app-login">
      <h1>{MESSAGES.login.title}</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor={usernameId}>{MESSAGES.login.username}</label>
        <input
          ref={usernameRef}
          id={usernameId}
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          aria-invalid={hasError}
          aria-describedby={describedBy}
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
          aria-invalid={hasError}
          aria-describedby={describedBy}
          required
        />
        {hasError ? (
          <p id={errorId} className="app-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button type="submit" disabled={submit.isPending}>
          {submit.isPending ? MESSAGES.login.submitting : MESSAGES.login.submit}
        </button>
      </form>
    </main>
  );
}
