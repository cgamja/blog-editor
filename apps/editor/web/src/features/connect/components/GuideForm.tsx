import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../../../shared/api/errors";
import { GUIDE_MAX_LENGTH, GUIDE_ROWS } from "../constants";
import { useSaveGuide } from "../hooks/use-workspace-settings";
import { CONNECT_MESSAGES as M } from "../messages";

type SaveGuide = ReturnType<typeof useSaveGuide>;

/** 가이드 저장 상태 한 줄 — 실패면 API 문장(길이 초과 등)을 그대로 보인다 */
function guideStatusOf(save: SaveGuide, isDirty: boolean): string {
  if (save.isPending) return M.savingGuide;
  if (save.isError) {
    const { error } = save;
    return error instanceof ApiError && error.userMessage !== null
      ? error.userMessage
      : M.saveFailed;
  }
  if (save.isSuccess && !isDirty) return M.savedGuide;
  return M.guideHint;
}

/**
 * 글쓰기 가이드 — 저장하면 MCP `get_writing_guide`가 형식 가이드 뒤에 붙여 AI에게 준다.
 * 고치지 않은 동안은 서버 값(`savedGuide`)을 그대로 보이고, 고친 글은 저장이 끝날 때까지 지킨다
 * (저장 중 · 다시 불러오기에 입력이 지워지지 않는다). 저장하는 동안은 읽기 전용이다.
 */
export function GuideForm({ savedGuide }: { savedGuide: string }) {
  const guideId = useId();
  const statusId = useId();
  // null = 고치지 않음(서버 값을 따른다)
  const [draft, setDraft] = useState<string | null>(null);
  const save = useSaveGuide();
  const guide = draft ?? savedGuide;
  const isDirty = draft !== null && draft !== savedGuide;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(guide, { onSuccess: () => setDraft(null) });
  };

  return (
    <form className="connect-field" onSubmit={handleSubmit}>
      <label htmlFor={guideId} className="connect-label">
        {M.guideLabel}
      </label>
      <textarea
        id={guideId}
        className="connect-guide"
        rows={GUIDE_ROWS}
        maxLength={GUIDE_MAX_LENGTH}
        value={guide}
        readOnly={save.isPending}
        placeholder={M.guidePlaceholder}
        onChange={(event) => setDraft(event.target.value)}
        aria-describedby={statusId}
      />
      <div className="connect-row">
        <p
          id={statusId}
          className={save.isError ? "connect-hint connect-hint-error" : "connect-hint"}
          aria-live="polite"
        >
          {guideStatusOf(save, isDirty)}
        </p>
        <button type="submit" className="connect-button" disabled={!isDirty || save.isPending}>
          {M.saveGuide}
        </button>
      </div>
    </form>
  );
}
