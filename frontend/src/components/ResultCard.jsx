import GradeBadge from './GradeBadge.jsx'
import ReferralBanner from './ReferralBanner.jsx'
import ConfidenceBar from './ConfidenceBar.jsx'
import FundusViewer from './FundusViewer.jsx'
import { gradcamSrc as toGradcamSrc } from '../lib/api.js'
import { GRADES, isReferable } from '../lib/grades.js'

function ProbabilityBars({ probabilities, predicted }) {
  if (!Array.isArray(probabilities) || probabilities.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy/55">
        Daraja bo‘yicha ehtimollik
      </p>
      <div className="space-y-1.5">
        {probabilities.slice(0, GRADES.length).map((p, i) => {
          const pct = Math.round((p || 0) * 100)
          const active = i === predicted
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className={[
                  'w-20 shrink-0 text-[0.7rem] font-medium',
                  active ? 'text-navy' : 'text-navy/45',
                ].join(' ')}
              >
                {i} · {GRADES[i]?.short}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-50">
                <div
                  className={[
                    'h-full rounded-full transition-[width] duration-700 ease-out',
                    active ? 'bg-teal-600' : 'bg-navy/25',
                  ].join(' ')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={[
                  'w-9 shrink-0 text-right text-[0.7rem] tabular-nums',
                  active ? 'font-bold text-navy' : 'text-navy/45',
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

export default function ResultCard({ result, imageSrc }) {
  if (!result) return null

  const referable =
    typeof result.referable === 'boolean'
      ? result.referable
      : isReferable(result.grade)

  const heatmap = toGradcamSrc(result.gradcam_png_base64)

  return (
    <article className="animate-fade-in-up overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-card">
      <header className="border-b border-navy/10 bg-navy-50/60 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/70">
          Skrining natijasi
        </h2>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        {/* Left column — image + Grad-CAM toggle */}
        <div>
          <FundusViewer imageSrc={imageSrc} gradcamSrc={heatmap} />
        </div>

        {/* Right column — grade, banner, confidence, recommendation */}
        <div className="flex flex-col gap-5">
          <GradeBadge grade={result.grade} label={result.grade_label} />

          <ReferralBanner referable={referable} />

          <ConfidenceBar value={result.confidence} />

          <ProbabilityBars
            probabilities={result.probabilities}
            predicted={result.grade}
          />

          {result.recommendation && (
            <div className="rounded-xl border border-navy/10 bg-mist px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/55">
                Tavsiya
              </p>
              <p className="text-sm leading-relaxed text-navy">
                {result.recommendation}
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-navy/10 bg-mist/60 px-5 py-2.5 sm:px-6">
        <p className="text-[0.7rem] leading-relaxed text-navy/55">
          Bu natija — skrining yordamchisi chiqargan triage tavsiyasi, tashxis emas.
        </p>
      </footer>
    </article>
  )
}
