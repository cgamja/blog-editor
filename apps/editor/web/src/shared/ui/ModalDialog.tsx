import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import "./modal-dialog.css";

interface ModalDialogProps {
  open: boolean;
  /** Esc · 바깥 닫기 등 브라우저가 닫았을 때도 불린다 — 부모가 `open`을 내린다 */
  onClose: () => void;
  /** 제목 요소의 id — 대화상자 이름이 된다 */
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * 네이티브 `<dialog>` 모달 — `showModal()`이 포커스 가두기 · Esc · 배경 비활성(inert)을 맡는다
 * (https://developer.mozilla.org/docs/Web/HTML/Element/dialog). 열림의 진실은 부모의 `open` 하나다.
 */
export function ModalDialog({ open, onClose, labelledBy, className, children }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className === undefined ? "modal-dialog" : `modal-dialog ${className}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
    >
      {open ? children : null}
    </dialog>
  );
}
