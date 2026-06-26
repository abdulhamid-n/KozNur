// Shown while /predict runs: the specimen is "scanned" on the dark stage,
// the readout panel shows quiet instrument placeholders.
export default function LoadingState({ imageSrc }) {
  return (
    <div className="grid animate-fade-in gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Stage with scanning sweep */}
      <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-shell-900 shadow-stage">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2">
          <span className="micro-label text-white/45">Ko‘rik maydoni</span>
          <span className="num flex items-center gap-1.5 text-[0.62rem] text-instrument">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-instrument" />
            SKANER
          </span>
        </div>
        <div className="relative aspect-square w-full bg-[radial-gradient(circle_at_center,#16242E,#0E1A24)]">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Tahlil qilinayotgan fundus surati"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          ) : (
            <div className="skeleton-dark absolute inset-0" />
          )}
          {/* scanning line */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 animate-scan bg-gradient-to-b from-transparent via-instrument/25 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-px animate-scan bg-instrument/70" />
          </div>
          {/* corner ticks */}
          <div className="pointer-events-none absolute inset-3" aria-hidden="true">
            {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map(
              (c, i) => (
                <span key={i} className={`absolute h-5 w-5 border-instrument/60 ${c}`} />
              )
            )}
          </div>
        </div>
        <div className="border-t border-white/[0.06] px-3.5 py-2.5">
          <p className="num text-[0.62rem] text-white/40">
            Model fundus tasvirni baholamoqda…
          </p>
        </div>
      </div>

      {/* Readout placeholders */}
      <div className="flex flex-col gap-4 rounded-lg border border-exam-200 bg-exam-0 p-4 sm:p-5">
        <div className="rounded-lg border border-exam-200 p-4">
          <div className="mb-4 flex items-start justify-between">
            <div className="space-y-2">
              <div className="skeleton h-2.5 w-24 rounded" />
              <div className="skeleton h-5 w-32 rounded" />
            </div>
            <div className="skeleton h-12 w-16 rounded" />
          </div>
          <div className="skeleton h-2.5 w-full rounded-full" />
          <div className="mt-3 flex justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-3 w-4 rounded" />
            ))}
          </div>
        </div>
        <div className="skeleton h-16 w-full rounded-lg" />
        <div className="space-y-2">
          <div className="skeleton h-2.5 w-28 rounded" />
          <div className="skeleton h-1.5 w-full rounded-full" />
        </div>
        <div className="skeleton h-24 w-full rounded-lg" />
      </div>
    </div>
  )
}
