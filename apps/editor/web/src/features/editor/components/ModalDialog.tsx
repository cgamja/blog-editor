import { useEffect, useId, useRef, type ReactNode } from "react";

export interface ModalDialogProps {
  title: ReactNode;
  children: ReactNode;
  /** Esc · 바깥 동작으로 닫을 때 */
  onClose: () => void;
  className?: string;
}

/**
 * 모달 대화상자 — 네이티브 `<dialog>`의 `showModal()`이 포커스 가두기 · Esc · 뒤 화면 비활성(inert)을 맡는다.
 * https://developer.mozilla.org/docs/Web/HTML/Element/dialog
 */
export function ModalDialog({ title, children, onClose, className }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`editor-dialog ${className ?? ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="editor-dialog-title">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
