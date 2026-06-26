// Persistent disclaimer footer — triage, not diagnosis (ARCHITECTURE §1/§6).

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-navy/10 bg-white/70 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-navy/65">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="mt-0.5 shrink-0 text-teal-600"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 11v5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle cx="12" cy="7.8" r="1.05" fill="currentColor" />
            </svg>
            <span>
              <strong className="font-semibold text-navy">
                Bu vosita tashxis emas, faqat skrining yordamchisi.
              </strong>{' '}
              Yakuniy qaror malakali oftalmolog tomonidan qabul qilinadi.
            </span>
          </p>
          <p className="text-[0.7rem] font-medium tracking-wide text-navy/45">
            Zeno · Ko‘zNur
          </p>
        </div>
      </div>
    </footer>
  )
}
