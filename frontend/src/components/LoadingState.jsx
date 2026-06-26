// Calm loading state shown while /predict is running.
export default function LoadingState({ imageSrc }) {
  return (
    <article className="animate-fade-in-up overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-card">
      <header className="border-b border-navy/10 bg-navy-50/60 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/70">
          Tahlil qilinmoqda…
        </h2>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-navy/10 bg-navy-900">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="Tahlil qilinayotgan fundus surati"
              className="h-full w-full object-cover opacity-80"
            />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
          {/* Scanning sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 -top-1/2 h-1/2 bg-gradient-to-b from-transparent via-teal-300/30 to-transparent animate-fade-in-up" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/30 border-t-teal-300" />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <div className="skeleton h-16 w-16 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-40" />
            </div>
          </div>
          <div className="skeleton h-16 w-full rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-full rounded-full" />
          </div>
          <div className="skeleton h-24 w-full rounded-xl" />
        </div>
      </div>

      <footer className="border-t border-navy/10 bg-mist/60 px-5 py-3 sm:px-6">
        <p className="flex items-center gap-2 text-xs text-navy/60">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
          Model fundus rasmni baholamoqda va Grad-CAM xaritasini tayyorlamoqda…
        </p>
      </footer>
    </article>
  )
}
