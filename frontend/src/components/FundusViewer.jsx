import { useEffect, useState } from 'react'

// The dark "viewing stage": the fundus sits mounted like a specimen under
// examination, framed by measurement corner-ticks. The Grad-CAM is a
// toggleable overlay with an opacity slider and a heat-scale legend.

function CornerTicks() {
  // Thin measurement reticle at each corner of the mount.
  const common = 'absolute h-5 w-5 border-instrument/70'
  return (
    <div className="pointer-events-none absolute inset-3 z-20" aria-hidden="true">
      <span className={`${common} left-0 top-0 border-l border-t`} />
      <span className={`${common} right-0 top-0 border-r border-t`} />
      <span className={`${common} bottom-0 left-0 border-b border-l`} />
      <span className={`${common} bottom-0 right-0 border-b border-r`} />
    </div>
  )
}

export default function FundusViewer({ imageSrc, gradcamSrc, idle = false }) {
  const hasHeatmap = Boolean(gradcamSrc)
  const [show, setShow] = useState(false)
  const [opacity, setOpacity] = useState(0.7)

  // Auto-enable the overlay when a heatmap first arrives.
  useEffect(() => {
    if (hasHeatmap) setShow(true)
  }, [hasHeatmap])

  return (
    <div className="flex h-full flex-col">
      {/* Stage chassis */}
      <div className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-shell-900 shadow-stage">
        {/* Stage header rail */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2">
          <span className="micro-label text-white/45">Ko‘rik maydoni</span>
          <span className="num text-[0.62rem] text-white/35">FUNDUS · 224px</span>
        </div>

        {/* Specimen mount */}
        <div className="relative aspect-square w-full bg-[radial-gradient(circle_at_center,#16242E,#0E1A24)]">
          {/* faint crosshair guides */}
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-[0.10]"
            aria-hidden="true"
          >
            <div className="absolute left-1/2 top-0 h-full w-px bg-instrument" />
            <div className="absolute left-0 top-1/2 h-px w-full bg-instrument" />
          </div>

          <CornerTicks />

          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Fundus (ko‘z tubi) surati"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="micro-label text-white/30">
                {idle ? 'Mavjud emas' : 'Rasm yo‘q'}
              </span>
            </div>
          )}

          {/* Grad-CAM overlay */}
          {hasHeatmap && (
            <img
              src={gradcamSrc}
              alt="Grad-CAM diqqat xaritasi"
              aria-hidden={!show}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
              style={{ opacity: show ? opacity : 0 }}
            />
          )}

          {/* Active-overlay tag */}
          {hasHeatmap && show && (
            <span className="num absolute left-5 top-5 z-30 rounded bg-shell-900/80 px-2 py-1 text-[0.6rem] font-600 tracking-wide text-instrument backdrop-blur-sm">
              GRAD-CAM
            </span>
          )}
        </div>

        {/* Stage controls — only meaningful when a heatmap exists */}
        {hasHeatmap && (
          <div className="border-t border-white/[0.06] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="micro-label text-white/45">
                Diqqat xaritasi
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={show}
                onClick={() => setShow((v) => !v)}
                className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-instrument/60 rounded"
              >
                <span
                  className={[
                    'relative h-[18px] w-8 rounded-full transition-colors',
                    show ? 'bg-instrument' : 'bg-white/15',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                      show ? 'translate-x-[15px]' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </span>
                <span className="num text-[0.62rem] font-600 text-white/70">
                  {show ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Opacity slider */}
            <div className="mt-3 flex items-center gap-3">
              <span className="micro-label w-14 shrink-0 text-white/35">
                Shaffof.
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(opacity * 100)}
                disabled={!show}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                aria-label="Grad-CAM shaffofligi"
                className={[
                  'instrument-slider flex-1',
                  show ? '' : 'opacity-40',
                ].join(' ')}
              />
              <span className="num w-9 shrink-0 text-right text-[0.68rem] text-white/60">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            {/* Heat-scale legend */}
            <div className="mt-3 flex items-center gap-2.5">
              <span className="micro-label shrink-0 text-white/35">Past</span>
              <div
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg,#1b3a8c 0%,#1f9d8b 30%,#e0c12e 60%,#db7c26 80%,#c0392b 100%)',
                }}
                aria-hidden="true"
              />
              <span className="micro-label shrink-0 text-white/35">Yuqori</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
