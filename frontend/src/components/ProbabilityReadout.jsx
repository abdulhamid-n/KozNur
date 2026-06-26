import { useEffect, useState } from 'react'
import { GRADES, gradeColor } from '../lib/grades.js'

// Per-grade softmax probabilities as an instrument readout. Each bar carries
// its grade-ramp color; the predicted grade is emphasized. Bars fill once.
export default function ProbabilityReadout({ probabilities, predicted }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setArmed(true)
      return
    }
    const t = setTimeout(() => setArmed(true), 150)
    return () => clearTimeout(t)
  }, [])

  if (!Array.isArray(probabilities) || probabilities.length === 0) return null

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="micro-label text-ink-40">Daraja ehtimolligi</span>
        <span className="num text-[0.6rem] text-ink-40">softmax · 5</span>
      </div>
      <div className="space-y-2">
        {probabilities.slice(0, GRADES.length).map((p, i) => {
          const pct = Math.round((p || 0) * 100)
          const active = i === predicted
          const color = gradeColor(i)
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className={[
                  'num w-4 shrink-0 text-right text-[0.72rem] font-600',
                  active ? '' : 'text-ink-40',
                ].join(' ')}
                style={active ? { color } : undefined}
              >
                {i}
              </span>
              <span
                className={[
                  'w-[5.5rem] shrink-0 truncate text-[0.68rem]',
                  active ? 'font-600 text-ink' : 'text-ink-55',
                ].join(' ')}
              >
                {GRADES[i]?.short}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-exam-100">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    width: armed ? `${pct}%` : '0%',
                    backgroundColor: active ? color : 'rgba(14,26,36,0.22)',
                  }}
                />
              </div>
              <span
                className={[
                  'num w-10 shrink-0 text-right text-[0.72rem]',
                  active ? 'font-600 text-ink' : 'text-ink-40',
                ].join(' ')}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
