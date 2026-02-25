import { useEffect } from "react";
import "./Toast.css";

export default function Toast({ id, type = "success", message, onClose, duration = 2400 }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div className={`toast toast--${type}`} role="status" aria-live="polite">
      <span className="toast__icon">
        {type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}
      </span>
      <span className="toast__msg">{message}</span>
      <button className="toast__close" onClick={onClose}>×</button>
    </div>
  );
}