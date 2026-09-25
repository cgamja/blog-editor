import { useId, type ReactNode } from "react";
import type { PostMeta } from "@blog-editor/content-schema";
import { EDITOR_MESSAGES } from "../messages";
import type { EditableMeta } from "../types";

export interface PostInfoPanelProps {
  meta: PostMeta;
  isPublished: boolean;
  /** 주소 칸(`SlugField`) — 주소는 저장 흐름(주소 바꾸기 · 잠금)과 묶여 있어 화면이 조립한다 */
  slugField: ReactNode;
  /** 기존 글에서 쓰인 카테고리 — 제안만 한다(목록 API는 설정 #98) */
  categories: readonly string[];
  onMetaChange: (patch: EditableMeta) => void;
  onOpenDecorate: () => void;
}

/** 「글 정보」 탭(디자인 68:2) — 주소 · 카테고리 · 설명 · 핵심 검색어 · 날짜 · 꾸미기 열기 · AI와 다듬기 */
export function PostInfoPanel({
  meta,
  isPublished,
  slugField,
  categories,
  onMetaChange,
  onOpenDecorate,
}: PostInfoPanelProps) {
  const { info } = EDITOR_MESSAGES;
  const id = useId();
  const ids = {
    category: `${id}-category`,
    categories: `${id}-categories`,
    categoryHint: `${id}-category-hint`,
    description: `${id}-description`,
    descriptionHint: `${id}-description-hint`,
    keyword: `${id}-keyword`,
    keywordHint: `${id}-keyword-hint`,
    date: `${id}-date`,
    aiHint: `${id}-ai-hint`,
  };

  return (
    <div className="post-info">
      <div className="post-info-head">
        <h2 className="post-info-heading">{info.heading}</h2>
        <span className="post-info-badge">{isPublished ? info.published : info.draft}</span>
      </div>

      {slugField}

      <div className="post-info-field">
        <label htmlFor={ids.category}>{info.category}</label>
        <input
          id={ids.category}
          type="text"
          list={ids.categories}
          value={meta.category}
          autoComplete="off"
          aria-describedby={ids.categoryHint}
          onChange={(event) => onMetaChange({ category: event.target.value })}
        />
        <datalist id={ids.categories}>
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <p id={ids.categoryHint} className="post-info-hint">
          {info.categoryHint}
        </p>
      </div>

      <div className="post-info-field">
        <label htmlFor={ids.description}>{info.description}</label>
        <textarea
          id={ids.description}
          rows={4}
          value={meta.description}
          aria-describedby={ids.descriptionHint}
          onChange={(event) => onMetaChange({ description: event.target.value })}
        />
        <p id={ids.descriptionHint} className="post-info-hint">
          {info.descriptionHint}
        </p>
      </div>

      <div className="post-info-field">
        <label htmlFor={ids.keyword}>{info.keyword}</label>
        <input
          id={ids.keyword}
          type="text"
          value={meta.keyword ?? ""}
          autoComplete="off"
          aria-describedby={ids.keywordHint}
          onChange={(event) => onMetaChange({ keyword: event.target.value })}
        />
        <p id={ids.keywordHint} className="post-info-hint">
          {info.keywordHint}
        </p>
      </div>

      <div className="post-info-field">
        <label htmlFor={ids.date}>{info.date}</label>
        <input
          id={ids.date}
          type="date"
          value={meta.date}
          required
          onChange={(event) => {
            if (event.target.value !== "") onMetaChange({ date: event.target.value });
          }}
        />
      </div>

      <div className="post-info-actions">
        <button type="button" className="post-info-button" onClick={onOpenDecorate}>
          {info.openDecorate}
        </button>
        {/* AI와 다듬기는 AI 연결 화면(#98)이 채운다 — 누를 수 없는 이유를 읽게 aria-disabled로 둔다 */}
        <button
          type="button"
          className="post-info-button"
          aria-disabled="true"
          aria-describedby={ids.aiHint}
        >
          {info.refineWithAi}
        </button>
        <span id={ids.aiHint} hidden>
          {info.refineWithAiLater}
        </span>
      </div>
    </div>
  );
}
