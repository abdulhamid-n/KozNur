// Clean KoʻzNur logotype: an "eye-light" mark + wordmark.
// Calm, medical, not flashy. Navy + teal only.

export function LogoMark({ size = 36, className = '' }) {
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
      <rect width="64" height="64" rx="15" fill="#0B3D66" />
      <path
        d="M12 32c0-7 9-13 20-13s20 6 20 13-9 13-20 13S12 39 12 32Z"
        stroke="#0F838C"
        strokeWidth="3.5"
        fill="none"
      />
      <circle cx="32" cy="32" r="8.5" fill="#0F838C" />
      <circle cx="32" cy="32" r="3.4" fill="#ffffff" />
      <circle cx="34.6" cy="29.4" r="1.5" fill="#ffffff" opacity="0.9" />
    </svg>
  )
}

export default function Logo({ size = 36, withWordmark = true }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <LogoMark size={size} />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[1.35rem] font-extrabold tracking-tight text-navy">
            Ko‘z<span className="text-teal">Nur</span>
          </span>
          <span className="mt-0.5 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-navy/55">
            Skrining yordamchisi
          </span>
        </span>
      )}
    </span>
  )
}
