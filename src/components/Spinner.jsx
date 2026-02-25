// src/components/Spinner.jsx
export default function Spinner({ size = 24, color = "#6c5ce7", ariaLabel = "Loading" }) {
  const style = {
    width: size,
    height: size,
    borderColor: `${color} transparent ${color} transparent`,
  };

  return (
    <span
      className="spinner"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      style={style}
    />
  );
}