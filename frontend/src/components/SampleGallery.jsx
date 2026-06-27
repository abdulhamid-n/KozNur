import { resolveUrl } from '../lib/api.js'
import { gradeInfo, gradeColor } from '../lib/grades.js'

export default function SampleGallery({
  samples,
  loading,
  error,
  onPick,
  activeId,
  busy,
}) {
  return (
    <section aria-labelledby="samples-heading">
      <div className="mb-3 flex items-baseline justify-between border-b border-exam-200 pb-2.5">
        <h2 id="samples-heading" className="micro-label text-ink-55">
          Namuna to‘plami
        </h2>
        <span className="num text-[0.62rem] text-ink-40">
          {loading ? '—' : `n=${samples.length}`}
        </span>
      </div>

      {error && !loading && (
        <p className="rounded-md border border-alert/30 bg-alert/[0.07] px-3 py-2 text-xs text-[#b0561f]">
          Namunalarni yuklab bo‘lmadi. Server ulanganini tekshiring.
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square w-full rounded-md" />
          ))}
        </div>
      ) : samples.length === 0 && !error ? (
        <p className="text-xs text-ink-55">Namuna rasmlar topilmadi.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2.5">
          {samples.map((s) => {
            const gi = s.grade != null ? gradeInfo(s.grade) : null
            const isActive = activeId === s.id
            const color = s.grade != null ? gradeColor(s.grade) : '#1D4ED8'
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(s)}
                aria-label={`Namuna: ${s.name}`}
                title={s.name}
                className={[
                  'group relative overflow-hidden rounded-md border bg-shell-900 text-left transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-instrument/60',
                  busy ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-px',
                  isActive
                    ? 'border-instrument ring-1 ring-instrument'
                    : 'border-exam-300/60 hover:border-instrument/50',
                ].join(' ')}
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={resolveUrl(s.thumb || s.url)}
                    alt={s.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.2'
                    }}
                  />
                </div>

                {/* grade-ramp swatch + numeral */}
                {gi && (
                  <span className="num absolute left-1 top-1 flex items-center gap-1 rounded bg-shell-900/80 px-1 py-0.5 text-[0.58rem] font-600 text-white backdrop-blur-sm">
                    <span
                      className="h-1.5 w-1.5 rounded-[2px]"
                      style={{ backgroundColor: color }}
                    />
                    {gi.grade}
                  </span>
                )}

                {isActive && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
      <p className="mt-3 text-[0.68rem] leading-relaxed text-ink-40">
        Sinab ko‘rish uchun namunani tanlang. Rang — kutilgan ICDR darajasi.
      </p>
    </section>
  )
}
