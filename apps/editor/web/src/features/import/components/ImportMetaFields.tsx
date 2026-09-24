import { useId } from "react";
import type { ChangeEvent } from "react";
import { IMPORT_MESSAGES as M } from "../messages";
import type { DraftInput, EditableDraftField } from "../types";

interface ImportMetaFieldsProps {
  input: DraftInput;
  categories: readonly string[];
  onEdit: (field: EditableDraftField, value: string) => void;
}

/** 초안 메타 입력 — 제목 · 주소 · 카테고리 · 설명(저장 규칙은 content-schema 메타) */
export function ImportMetaFields({ input, categories, onEdit }: ImportMetaFieldsProps) {
  const ids = {
    title: useId(),
    slug: useId(),
    slugHint: useId(),
    category: useId(),
    description: useId(),
  };
  const handleChange =
    (field: EditableDraftField) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onEdit(field, event.target.value);

  return (
    <div className="import-meta">
      <div className="import-field import-field-wide">
        <label htmlFor={ids.title} className="modal-dialog-label">
          {M.titleLabel}
        </label>
        <input
          id={ids.title}
          className="modal-dialog-control"
          value={input.title}
          onChange={handleChange("title")}
        />
      </div>
      <div className="import-field">
        <label htmlFor={ids.slug} className="modal-dialog-label">
          {M.slugLabel}
        </label>
        <input
          id={ids.slug}
          className="modal-dialog-control"
          value={input.slug}
          onChange={handleChange("slug")}
          aria-describedby={ids.slugHint}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <div className="import-field">
        <label htmlFor={ids.category} className="modal-dialog-label">
          {M.categoryLabel}
        </label>
        <select
          id={ids.category}
          className="modal-dialog-control"
          value={input.category}
          onChange={handleChange("category")}
        >
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <p id={ids.slugHint} className="import-hint import-field-wide">
        {M.slugHint}
      </p>
      <div className="import-field import-field-wide">
        <label htmlFor={ids.description} className="modal-dialog-label">
          {M.descriptionLabel}
        </label>
        <input
          id={ids.description}
          className="modal-dialog-control"
          value={input.description}
          onChange={handleChange("description")}
        />
      </div>
    </div>
  );
}
