import { useState, useCallback } from "react";
import Toast from "./Toast.jsx";
import "./Toast.css";

export default function ToastStack() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((t) => {
    const id = crypto.randomUUID?.() || String(Math.random());
    setToasts((list) => [...list, { id, ...t }]);
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  // Expose helper globally (optional convenience)
  window.toast = {
    success: (msg) => push({ type: "success", message: msg }),
    error: (msg) => push({ type: "error", message: msg }),
    info: (msg) => push({ type: "info", message: msg }),
    remove,
  };

  return (
    <div className="toast__stack" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}