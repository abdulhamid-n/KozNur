import Logo from './Logo.jsx'

export default function Header({ healthy }) {
  const state =
    healthy == null ? 'checking' : healthy ? 'online' : 'offline'

  const dot =
    state === 'online'
      ? 'bg-grade-0'
      : state === 'offline'
        ? 'bg-alert'
        : 'bg-shell-500'

  const label =
    state === 'online'
      ? 'Server ulangan'
      : state === 'offline'
        ? 'Aloqa yo‘q'
        : 'Tekshirilmoqda'

  const title =
    state === 'online'
      ? 'Server ulangan'
      : state === 'offline'
        ? 'Server bilan aloqa yo‘q'
        : 'Server holati tekshirilmoqda'

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-shell-900/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3 sm:px-8">
        <Logo size={34} tone="light" />

        <div className="flex items-center gap-3 sm:gap-5">
          <span className="hidden items-center gap-2 border-l border-white/10 pl-5 md:inline-flex">
            <span className="micro-label text-white/40">Modal</span>
            <span className="num text-[0.72rem] text-instrument">ICDR 0–4</span>
          </span>

          {/* Server status readout */}
          <span
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5"
            title={title}
          >
            <span className="relative flex h-2 w-2">
              {state === 'online' && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grade-0/60" />
              )}
              <span
                className={[
                  'relative inline-flex h-2 w-2 rounded-full',
                  dot,
                  state === 'checking' ? 'animate-pulse-dot' : '',
                ].join(' ')}
              />
            </span>
            <span className="micro-label text-white/55">{label}</span>
          </span>
        </div>
      </div>
    </header>
  )
}
