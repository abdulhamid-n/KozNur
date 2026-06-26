import { useEffect, useState } from 'react'

export default function ConfidenceBar({ value }) {
  const pct = Math.max(0, Math.min(100, Math.round((value || 0) * 100)))
  const [w, setW] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setW(pct)
      return
    }
    const t = setTimeout(() => setW(pct), 120)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="micro-label text-ink-40">Ishonchlilik</span>
        <span className="num text-lg font-600 leading-none text-ink">
          {pct}
          <span className="text-sm text-ink-40">%</span>
        </span>
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-exam-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Model ishonchliligi"
      >
        <div
          className="h-full rounded-full bg-instrument-deep transition-[width] duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  )
}
