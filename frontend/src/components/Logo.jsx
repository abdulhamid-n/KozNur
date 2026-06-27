// KoʻzNur instrument mark: a reticle-eye — measurement ticks around a
// fovea pupil. Reads as an aligned optical instrument, not a soft brand blob.

export function LogoMark({ size = 34, className = '', tone = 'light' }) {
  // tone="light" -> for dark backgrounds (header on shell)
  const ring = tone === 'light' ? '#3B82F6' : '#1D4ED8'
  const tick = tone === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(14,26,36,0.45)'
  const core = tone === 'light' ? '#F6F8F9' : '#0E1A24'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="KoʻzNur belgisi"
    >
      {/* outer measurement ring */}
      <circle cx="32" cy="32" r="26" stroke={ring} strokeWidth="2" opacity="0.9" />
      {/* corner reticle ticks */}
      <g stroke={tick} strokeWidth="2" strokeLinecap="round">
        <path d="M32 4v7" />
        <path d="M32 53v7" />
        <path d="M4 32h7" />
        <path d="M53 32h7" />
      </g>
      {/* iris */}
      <circle cx="32" cy="32" r="13" stroke={ring} strokeWidth="2.5" />
      {/* fovea pupil */}
      <circle cx="32" cy="32" r="5.5" fill={ring} />
      <circle cx="32" cy="32" r="2" fill={core} />
    </svg>
  )
}

export default function Logo({ size = 34, withWordmark = true, tone = 'light' }) {
  const dark = tone === 'light'
  return (
    <span className="inline-flex select-none items-center gap-2.5">
      <LogoMark size={size} tone={tone} />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={[
              'font-display text-[1.28rem] font-700 tracking-tight',
              dark ? 'text-exam-50' : 'text-ink',
            ].join(' ')}
            style={{ fontWeight: 700 }}
          >
            Koʻz<span className="text-instrument">Nur</span>
          </span>
          <span
            className={[
              'micro-label mt-1',
              dark ? 'text-white/45' : 'text-ink-55',
            ].join(' ')}
          >
            Retinal screening console
          </span>
        </span>
      )}
    </span>
  )
}
