import { useEffect, useState } from 'react'
import { GRADES, GRADE_RAMP, REFERABLE_THRESHOLD, gradeInfo } from '../lib/grades.js'

// SIGNATURE COMPONENT.
// The ICDR grade rendered as a calibrated 0->4 measurement scale. A marker
// animates to the predicted grade; the referable zone (>=2) is delineated on
// the track; the ramp runs green -> lime -> amber -> orange -> clinical red.

const COUNT = GRADES.length // 5 ticks: 0..4

export default function GradeGauge({ grade, label }) {
  const info = gradeInfo(grade)
  const uz = info ? info.uz : label || '—'
  const en = info ? info.en : label || ''
  const color = GRADE_RAMP[grade] ?? GRADE_RAMP[0]

  // Marker animates from 0 to its position on mount.
  const target = (grade / (COUNT - 1)) * 100
  const [pos, setPos] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setPos(target)
      return
    }
    const t = setTimeout(() => setPos(target), 80)
    return () => clearTimeout(t)
  }, [target])

  // Referable zone starts at grade 2 -> its left edge as a percentage.
  const refStart = (REFERABLE_THRESHOLD / (COUNT - 1)) * 100

  return (
    <section
      aria-label={`ICDR daraja: ${grade} — ${uz}`}
      className="rounded-lg border border-exam-200 bg-exam-0 p-4 sm:p-5"
    >
      {/* Header row: micro-label + the big grade numeral + class name */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="micro-label text-ink-40">ICDR · skrining darajasi</p>
          <p className="mt-1.5 font-display text-lg font-600 leading-none text-ink">
            {uz}
          </p>
          {en && en !== uz && (
            <p className="mt-1 text-xs text-ink-55">{en}</p>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="num text-[3.25rem] font-700 leading-none"
            style={{ color }}
          >
            {grade}
          </span>
          <span className="num pb-1 text-base font-500 text-ink-40">/4</span>
        </div>
      </div>

      {/* The calibrated track */}
      <div className="relative pt-7">
        {/* Marker — animates to the predicted grade */}
        <div
          className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 transition-[left] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ left: `${pos}%` }}
        >
          <div
            className="num mb-1 rounded px-1.5 py-0.5 text-[0.6rem] font-600 text-white shadow-control"
            style={{ backgroundColor: color }}
          >
            {grade}
          </div>
          {/* needle */}
          <svg
            width="14"
            height="9"
            viewBox="0 0 14 9"
            className="mx-auto block"
            style={{ color }}
            aria-hidden="true"
          >
            <path d="M7 9 0 0h14L7 9Z" fill="currentColor" />
          </svg>
        </div>

        {/* Track: full ramp gradient as faint base, lit up to the marker */}
        <div className="relative h-2.5 overflow-hidden rounded-full bg-exam-100">
          {/* Referable zone shading on the track */}
          <div
            className="absolute inset-y-0 right-0 bg-alert/12"
            style={{ left: `${refStart}%` }}
            aria-hidden="true"
          />
          {/* Filled ramp up to the predicted grade */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              width: `${pos}%`,
              background: `linear-gradient(90deg, ${GRADE_RAMP[0]}, ${color})`,
            }}
            aria-hidden="true"
          />
          {/* Referable threshold tick — crisp boundary across the track */}
          <div
            className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-alert"
            style={{ left: `${refStart}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Tick labels 0..4 */}
        <div className="mt-2.5 flex justify-between">
          {GRADES.map((g) => {
            const active = g.grade === grade
            return (
              <div
                key={g.grade}
                className="flex flex-1 flex-col items-center first:items-start last:items-end"
              >
                <span
                  className="num text-[0.78rem] font-600 leading-none transition-colors"
                  style={{ color: active ? GRADE_RAMP[g.grade] : 'rgba(14,26,36,0.4)' }}
                >
                  {g.grade}
                </span>
                <span
                  className={[
                    'mt-1 text-[0.6rem] leading-tight',
                    active ? 'font-600 text-ink' : 'text-ink-40',
                  ].join(' ')}
                >
                  {g.short}
                </span>
              </div>
            )
          })}
        </div>

        {/* Referable zone caption */}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-alert/30" aria-hidden="true" />
          <span className="micro-label text-ink-40">
            Yo‘naltirish zonasi · ≥ {REFERABLE_THRESHOLD}
          </span>
        </div>
      </div>
    </section>
  )
}
