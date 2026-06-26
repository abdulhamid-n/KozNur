import { REFERRAL_COPY } from '../lib/grades.js'

// Amber alert ONLY when referable. Otherwise a calm grade-0 green clearance.
export default function ReferralBanner({ referable }) {
  const copy = referable ? REFERRAL_COPY.referable : REFERRAL_COPY.notReferable

  return (
    <div
      role="status"
      className={[
        'relative overflow-hidden rounded-lg border pl-4 pr-4 py-3.5',
        referable
          ? 'border-alert/30 bg-alert/[0.07]'
          : 'border-grade-0/25 bg-grade-0/[0.06]',
      ].join(' ')}
    >
      {/* Status spine */}
      <span
        className={[
          'absolute inset-y-0 left-0 w-1',
          referable ? 'bg-alert' : 'bg-grade-0',
        ].join(' ')}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        <span
          className={[
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white',
            referable ? 'bg-alert' : 'bg-grade-0',
          ].join(' ')}
          aria-hidden="true"
        >
          {referable ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 8.5v4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16.4" r="1.1" fill="currentColor" />
              <path
                d="M10.3 4.4a2 2 0 0 1 3.4 0l7.1 12.3a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3l7.1-12.3Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="m6 12.5 3.6 3.6L18 7.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={[
                'micro-label',
                referable ? 'text-alert' : 'text-grade-0',
              ].join(' ')}
            >
              {referable ? 'Yo‘naltirish' : 'Tozalandi'}
            </span>
          </div>
          <p
            className={[
              'mt-1 font-display text-sm font-600 leading-snug',
              referable ? 'text-[#b0561f]' : 'text-[#15694e]',
            ].join(' ')}
          >
            {copy.title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-70">{copy.sub}</p>
        </div>
      </div>
    </div>
  )
}
