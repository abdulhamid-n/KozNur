export default function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round((value || 0) * 100)))

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy/55">
          Ishonchlilik
        </span>
        <span className="text-sm font-bold tabular-nums text-navy">{pct}%</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-navy-50"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Model ishonchliligi"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-600 to-navy transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
