import { useId } from "react";
import { EDITOR_MESSAGES } from "../messages";

export interface SlugFieldProps {
  slug: string;
  /** 발행 글은 주소가 URL이라 잠긴다 */
  isLocked: boolean;
  /** 서버가 거절한 이유(이미 있는 주소 · 발행 글) — 있으면 안내 대신 이 문장 */
  error: string | null;
  onChange: (slug: string) => void;
}

/** 「글 정보」의 주소 칸(디자인 68:2) — 발행 전까지 고칠 수 있고 발행하면 잠긴다 */
export function SlugField({ slug, isLocked, error, onChange }: SlugFieldProps) {
  const { info } = EDITOR_MESSAGES;
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="post-info-field">
      <label htmlFor={id}>{info.slug}</label>
      <input
        id={id}
        type="text"
        value={slug}
        readOnly={isLocked}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={error === null ? undefined : true}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={hintId} className={error === null ? "post-info-hint" : "post-info-error"}>
        {error ?? (isLocked ? info.slugLocked : info.slugHint)}
      </p>
    </div>
  );
}
