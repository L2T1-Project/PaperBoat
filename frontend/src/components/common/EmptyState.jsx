import { Link } from "react-router-dom";

export default function EmptyState({
  icon = "○",
  title,
  body,
  ctaLabel,
  ctaTo,
  ctaAction,
  className = "",
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center ${className}`}>
      <div className="text-3xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      {body ? <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">{body}</p> : null}
      {ctaLabel && ctaTo ? (
        <Link
          to={ctaTo}
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {ctaLabel}
        </Link>
      ) : null}
      {ctaLabel && !ctaTo && ctaAction ? (
        <button
          type="button"
          onClick={ctaAction}
          className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
