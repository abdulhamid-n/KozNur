import { resolveUrl } from '../lib/api.js'
import { gradeInfo } from '../lib/grades.js'

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
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="samples-heading" className="text-sm font-semibold text-navy">
          Namuna rasmlar
        </h2>
        <span className="text-xs text-navy/45">Sinab ko‘rish uchun bosing</span>
      </div>

      {error && !loading && (
        <p className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-700">
          Namunalarni yuklab bo‘lmadi. Server ulanganini tekshiring.
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : samples.length === 0 && !error ? (
        <p className="text-xs text-navy/50">Namuna rasmlar topilmadi.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {samples.map((s) => {
            const gi = s.grade != null ? gradeInfo(s.grade) : null
            const isActive = activeId === s.id
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(s)}
                aria-label={`Namuna: ${s.name}`}
                className={[
                  'group relative overflow-hidden rounded-xl border bg-navy-900 text-left transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  busy ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 hover:shadow-card',
                  isActive ? 'border-teal-600 ring-2 ring-teal-200' : 'border-navy/10',
                ].join(' ')}
              >
                <div className="aspect-square w-full overflow-hidden bg-navy-900">
                  <img
                    src={resolveUrl(s.thumb || s.url)}
                    alt={s.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.25'
                    }}
                  />
                </div>

                {gi && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-navy/80 px-1.5 py-0.5 text-[0.62rem] font-semibold text-white backdrop-blur-sm">
                    {gi.grade} · {gi.short}
                  </span>
                )}

                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-navy/85 to-transparent py-2 text-[0.7rem] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Sinab ko‘rish
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
