// Persistent disclaimer — triage, not diagnosis.

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-exam-200 bg-exam-50/80">
      <div className="mx-auto max-w-[1200px] px-5 py-4 sm:px-8">
        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-70">
            <span className="mt-px font-mono text-[0.62rem] font-600 tracking-micro text-instrument-deep">
              [!]
            </span>
            <span>
              <strong className="font-600 text-ink">
                Bu vosita tashxis emas, faqat skrining yordamchisi.
              </strong>{' '}
              Yakuniy qaror malakali oftalmolog tomonidan qabul qilinadi.
            </span>
          </p>
          <p className="flex items-center gap-2 whitespace-nowrap">
            <span className="micro-label text-ink-40">Team</span>
            <span className="font-display text-xs font-600 text-ink-70">
              Zeno
            </span>
            <span className="text-ink-40">·</span>
            <span className="font-display text-xs font-600 text-ink-70">
              KoʻzNur
            </span>
          </p>
        </div>
      </div>
    </footer>
  )
}
