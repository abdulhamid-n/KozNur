import { useState } from 'react'

// Shows the fundus image with a toggleable Grad-CAM heatmap overlay.
export default function FundusViewer({ imageSrc, gradcamSrc }) {
  const [showHeatmap, setShowHeatmap] = useState(false)
  const hasHeatmap = Boolean(gradcamSrc)

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-navy/10 bg-navy-900">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Fundus (ko‘z tubi) surati"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-navy/30">
            <span className="text-xs">Rasm mavjud emas</span>
          </div>
        )}

        {hasHeatmap && (
          <img
            src={gradcamSrc}
            alt="Grad-CAM issiqlik xaritasi"
            aria-hidden={!showHeatmap}
            className={[
              'pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
              showHeatmap ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
        )}

        {showHeatmap && hasHeatmap && (
          <span className="absolute left-2 top-2 rounded-md bg-navy/80 px-2 py-1 text-[0.65rem] font-semibold text-white backdrop-blur-sm">
            Grad-CAM
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-navy/55">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Issiqlik xaritasi — model e’tibor bergan hududlar
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={showHeatmap}
          disabled={!hasHeatmap}
          onClick={() => setShowHeatmap((v) => !v)}
          className={[
            'inline-flex items-center gap-2 rounded-full px-1 py-1 text-xs font-semibold transition-colors',
            !hasHeatmap ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            className={[
              'relative h-6 w-11 rounded-full transition-colors',
              showHeatmap ? 'bg-teal-600' : 'bg-navy/20',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                showHeatmap ? 'translate-x-[22px]' : 'translate-x-0.5',
              ].join(' ')}
            />
          </span>
          <span className="text-navy">
            Grad-CAM {showHeatmap ? 'yoqilgan' : 'o‘chiq'}
          </span>
        </button>
      </div>
    </div>
  )
}
