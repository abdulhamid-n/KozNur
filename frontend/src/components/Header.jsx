import Logo from './Logo.jsx'

export default function Header({ healthy }) {
  return (
    <header className="sticky top-0 z-20 border-b border-navy/10 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Logo size={38} />

        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            Triage · skrining
          </span>

          <span
            className="inline-flex items-center gap-2 text-xs font-medium text-navy/55"
            title={
              healthy == null
                ? 'Server holati tekshirilmoqda'
                : healthy
                  ? 'Server ulangan'
                  : 'Server bilan aloqa yo‘q'
            }
          >
            <span
              className={[
                'h-2.5 w-2.5 rounded-full transition-colors',
                healthy == null
                  ? 'bg-navy/25'
                  : healthy
                    ? 'bg-calm-600'
                    : 'bg-accent-600',
              ].join(' ')}
            />
            <span className="hidden sm:inline">
              {healthy == null
                ? 'Tekshirilmoqda…'
                : healthy
                  ? 'Server ulangan'
                  : 'Aloqa yo‘q'}
            </span>
          </span>
        </div>
      </div>
    </header>
  )
}
