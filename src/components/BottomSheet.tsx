import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="sheet-overlay" onClick={onClose} role="presentation">
      <section
        className="bottom-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="sheet-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h3>{title}</h3>
          <button onClick={onClose} type="button">
            关闭
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
