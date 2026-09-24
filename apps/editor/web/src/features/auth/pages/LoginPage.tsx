import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../../../shared/api/errors";
import { MESSAGES } from "../../../shared/messages";
import { NEXT_PARAM } from "../../../shared/routes/constants";
import { safeNextPath } from "../../../shared/routes/next-path";
import { login } from "../api";
import { AUTH_MESSAGES } from "../messages";
import { markSignedIn } from "../session-cache";

function loginErrorMessage(error: Error | null): string | null {
  if (error === null) return null;
  if (error instanceof ApiError && error.userMessage !== null) return error.userMessage;
  return AUTH_MESSAGES.login.failed;
}

/**
 * 로그인(결정 아티팩트 1 · A안 종이 위 카드). 실패하면 API 문장 + 잠금 고정 안내를 보이고 첫 입력칸으로 포커스를
 * 옮긴다. 디자인의 "남은 횟수 · 잠금 시간"은 보이지 않는다 — 서버가 잠김 여부를 응답으로 드러내지 않는다(api-session).
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
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
    <main className="login">
      <form className="login-card" aria-labelledby={titleId} onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <span className="brand-logo">{MESSAGES.brand}</span>
          <span className="brand-sub">{MESSAGES.appTitle}</span>
        </div>
        <h1 id={titleId} className="visually-hidden">
          {AUTH_MESSAGES.login.title}
        </h1>
        <div className="field">
          <label htmlFor={usernameId}>{AUTH_MESSAGES.login.username}</label>
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
        </div>
        <div className="field">
          <label htmlFor={passwordId}>{AUTH_MESSAGES.login.password}</label>
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
            <p id={errorId} className="field__error" role="alert">
              <span>{errorMessage}</span> <span>{AUTH_MESSAGES.login.lockNotice}</span>
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className="app-button app-button--primary app-button--full"
          disabled={submit.isPending}
        >
          {submit.isPending ? AUTH_MESSAGES.login.submitting : AUTH_MESSAGES.login.submit}
        </button>
      </form>
    </main>
  );
}
