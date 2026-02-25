import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

export default function Modal({
  open,
  onClose,
  icon = "success", // "success" | "error" | "info"
  title = "Success",
  message = "",
  primaryText = "OK",
  onPrimary = onClose,
  secondaryText,
  onSecondary,
  autoCloseMs, // e.g., 1800
}) {
  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  const Icon = () => {
    if (icon === "success")
      return (
        <span className="modal__badge modal__badge--success" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="modal__badge-svg">
            <circle cx="12" cy="12" r="12" className="modal__badge-bg" />
            <path
              d="M6.5 12.5l3.5 3.5 7.5-7.5"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    if (icon === "error")
      return (
        <span className="modal__badge modal__badge--error" aria-hidden="true">
          ✖
        </span>
      );
    return (
      <span className="modal__badge modal__badge--info" aria-hidden="true">
        ℹ️
      </span>
    );
  };

  return createPortal(
    <div className="modal__backdrop" role="dialog" aria-modal="true">
      <div className="modal__card">
        <button aria-label="Close" className="modal__close" onClick={onClose}>
          ×
        </button>
        <Icon />
        <h3 className="modal__title">{title}</h3>
        {message && <p className="modal__message">{message}</p>}
        <div className="modal__actions">
          {secondaryText && (
            <button className="btn btn--ghost" onClick={onSecondary}>
              {secondaryText}
            </button>
          )}
          <button className="btn btn--primary" onClick={onPrimary}>
            {primaryText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}