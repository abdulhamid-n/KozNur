import ReferralBanner from './ReferralBanner.jsx'
import ConfidenceBar from './ConfidenceBar.jsx'
import FundusViewer from './FundusViewer.jsx'
import GradeGauge from './GradeGauge.jsx'
import ProbabilityReadout from './ProbabilityReadout.jsx'
import { gradcamSrc as toGradcamSrc } from '../lib/api.js'
import { isReferable } from '../lib/grades.js'

export default function ResultCard({ result, imageSrc }) {
  if (!result) return null

  const referable =
    typeof result.referable === 'boolean'
      ? result.referable
      : isReferable(result.grade)

  const heatmap = toGradcamSrc(result.gradcam_png_base64)

  return (
    <div className="animate-settle-in grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* LEFT — viewing stage */}
      <FundusViewer imageSrc={imageSrc} gradcamSrc={heatmap} />

      {/* RIGHT — readout panel */}
      <div className="flex flex-col rounded-lg border border-exam-200 bg-exam-0 shadow-readout">
        <div className="flex items-center justify-between border-b border-exam-200 px-4 py-2.5">
          <span className="micro-label text-ink-55">Tashxis o‘qilishi</span>
          <span className="num text-[0.62rem] text-ink-40">READOUT</span>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {/* Signature gauge */}
          <GradeGauge grade={result.grade} label={result.grade_label} />

          <ReferralBanner referable={referable} />

          <div className="grid gap-4">
            <ConfidenceBar value={result.confidence} />
            <ProbabilityReadout
              probabilities={result.probabilities}
              predicted={result.grade}
            />
          </div>

          {result.recommendation && (
            <div className="rounded-lg border border-exam-200 bg-exam-50 px-4 py-3">
              <p className="micro-label mb-1.5 text-ink-40">Tavsiya</p>
              <p className="text-sm leading-relaxed text-ink">
                {result.recommendation}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-exam-200 px-4 py-2.5">
          <p className="text-[0.68rem] leading-relaxed text-ink-40">
            Triage tavsiyasi — tashxis emas. Yakuniy qaror oftalmologda.
          </p>
        </div>
      </div>
    </div>
  )
}
