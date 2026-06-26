import { gradeInfo, isReferable } from '../lib/grades.js'

export default function GradeBadge({ grade, label }) {
  const info = gradeInfo(grade)
  const referable = isReferable(grade)
  const uz = info ? info.uz : label || '—'
  const en = info ? info.en : label || ''

  return (
    <div className="flex items-center gap-3.5">
      <div
        className={[
          'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-soft',
          referable
            ? 'bg-gradient-to-br from-accent-600 to-accent-700'
            : 'bg-gradient-to-br from-navy to-navy-900',
        ].join(' ')}
      >
        <span className="text-[0.58rem] font-medium uppercase tracking-wider opacity-80">
          Daraja
        </span>
        <span className="text-3xl font-extrabold leading-none">{grade}</span>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-navy/50">
          ICDR baholash · 0–4
        </p>
        <p className="text-xl font-extrabold leading-tight text-navy">{uz}</p>
        {en && en !== uz && (
          <p className="text-xs font-medium text-navy/45">{en}</p>
        )}
      </div>
    </div>
  )
}
