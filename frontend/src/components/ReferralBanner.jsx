import { REFERRAL_COPY } from '../lib/grades.js'

// Calm green when no referral needed; warm amber accent ONLY when referable.
export default function ReferralBanner({ referable }) {
  const copy = referable ? REFERRAL_COPY.referable : REFERRAL_COPY.notReferable

  return (
    <div
      role="status"
      className={[
        'flex items-start gap-3 rounded-xl border px-4 py-3.5',
        referable
          ? 'border-accent-200 bg-accent-50'
          : 'border-calm-100 bg-calm-50',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white',
          referable ? 'bg-accent-600' : 'bg-calm-600',
        ].join(' ')}
        aria-hidden="true"
      >
        {referable ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8.5v4.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="16.3" r="1.1" fill="currentColor" />
            <path
              d="M10.3 4.4a2 2 0 0 1 3.4 0l7.1 12.3a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3l7.1-12.3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="m6 12.5 3.6 3.6L18 7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <div>
        <p
          className={[
            'text-base font-bold leading-tight',
            referable ? 'text-accent-700' : 'text-calm-700',
          ].join(' ')}
        >
          {copy.title}
        </p>
        <p className="mt-0.5 text-sm text-navy/65">{copy.sub}</p>
      </div>
    </div>
  )
}
