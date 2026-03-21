export default function DisabledHint({ show, text, className = "" }) {
  if (!show) return null;

  return (
    <p className={`mt-2 text-xs text-slate-500 ${className}`} role="note">
      {text}
    </p>
  );
}
