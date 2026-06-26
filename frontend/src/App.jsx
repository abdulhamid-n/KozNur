import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import UploadZone from './components/UploadZone.jsx'
import SampleGallery from './components/SampleGallery.jsx'
import LoadingState from './components/LoadingState.jsx'
import ResultCard from './components/ResultCard.jsx'
import { REFERABLE_THRESHOLD } from './lib/grades.js'
import {
  getSamples,
  getHealth,
  predict,
  predictSample,
  resolveUrl,
} from './lib/api.js'

export default function App() {
  const [healthy, setHealthy] = useState(null)

  const [samples, setSamples] = useState([])
  const [samplesLoading, setSamplesLoading] = useState(true)
  const [samplesError, setSamplesError] = useState(false)

  const [imageSrc, setImageSrc] = useState(null)
  const [activeSampleId, setActiveSampleId] = useState(null)

  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const objectUrlRef = useRef(null)
  const resultRef = useRef(null)

  const setPreviewFromFile = useCallback((file) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setImageSrc(url)
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  useEffect(() => {
    let alive = true
    getHealth().then((ok) => alive && setHealthy(ok))

    setSamplesLoading(true)
    getSamples()
      .then((list) => {
        if (!alive) return
        setSamples(list)
        setSamplesError(false)
      })
      .catch(() => alive && setSamplesError(true))
      .finally(() => alive && setSamplesLoading(false))

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (status === 'loading' || status === 'done') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [status])

  const runFile = useCallback(
    async (file) => {
      setActiveSampleId(null)
      setPreviewFromFile(file)
      setResult(null)
      setError(null)
      setStatus('loading')
      try {
        const r = await predict(file)
        setResult(r)
        setStatus('done')
      } catch (e) {
        setError(e?.message || 'Noma’lum xatolik yuz berdi.')
        setStatus('error')
      }
    },
    [setPreviewFromFile]
  )

  const runSample = useCallback(async (sample) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setActiveSampleId(sample.id)
    setImageSrc(resolveUrl(sample.url))
    setResult(null)
    setError(null)
    setStatus('loading')
    try {
      const r = await predictSample(sample)
      setResult(r)
      setStatus('done')
    } catch (e) {
      setError(e?.message || 'Namunani tahlil qilishda xatolik yuz berdi.')
      setStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setStatus('idle')
    setResult(null)
    setError(null)
    setImageSrc(null)
    setActiveSampleId(null)
  }, [])

  const busy = status === 'loading'
  const showWorkspace = status !== 'idle'

  return (
    <div className="flex min-h-screen flex-col">
      <Header healthy={healthy} />

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-7 sm:px-8 sm:py-9">
        {/* Console title block */}
        <section className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-exam-200 pb-6">
          <div className="max-w-2xl">
            <p className="micro-label text-instrument-deep">
              Diabetik retinopatiya · skrining konsoli
            </p>
            <h1 className="mt-2.5 font-display text-[1.7rem] font-700 leading-[1.1] tracking-tight text-ink sm:text-[2.05rem]">
              Fundus tasvirni ICDR shkalasida baholang
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-70">
              Ko‘z tubi suratini mountga joylang — KoʻzNur darajani{' '}
              <span className="num font-600 text-ink">0–4</span> shkalasida
              o‘lchaydi, yo‘naltirish zarurligini belgilaydi va model diqqat
              qaratgan hududlarni Grad-CAM xaritasida ko‘rsatadi.
            </p>
          </div>

          {/* Calibration legend — quiet, instrument-like */}
          <dl className="hidden shrink-0 gap-5 sm:flex">
            <div>
              <dt className="micro-label text-ink-40">Shkala</dt>
              <dd className="num mt-1 text-sm font-600 text-ink">ICDR 0–4</dd>
            </div>
            <div className="border-l border-exam-200 pl-5">
              <dt className="micro-label text-ink-40">Yo‘naltirish</dt>
              <dd className="num mt-1 text-sm font-600 text-alert">
                ≥ {REFERABLE_THRESHOLD}
              </dd>
            </div>
          </dl>
        </section>

        {/* Workspace */}
        <div ref={resultRef} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Primary examination column */}
          <div className="min-w-0">
            {/* Workspace status rail (only once something is loaded) */}
            {showWorkspace && (
              <div className="mb-4 flex items-center justify-between">
                <p className="micro-label flex items-center gap-2 text-ink-55">
                  <span
                    className={[
                      'h-1.5 w-1.5 rounded-full',
                      busy
                        ? 'animate-pulse-dot bg-instrument'
                        : status === 'error'
                          ? 'bg-alert'
                          : 'bg-grade-0',
                    ].join(' ')}
                  />
                  {busy
                    ? 'Tahlil davom etmoqda'
                    : status === 'error'
                      ? 'Tahlil bajarilmadi'
                      : 'Natija tayyor'}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-exam-300 bg-exam-0 px-3 py-1.5 text-xs font-600 text-ink transition-colors hover:border-instrument/60 hover:text-instrument-deep disabled:opacity-50"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 5v5h5M20 19v-5h-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 9a7 7 0 0 0-12.9-2.5M5 15a7 7 0 0 0 12.9 2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                  </svg>
                  Yangi tasvir
                </button>
              </div>
            )}

            {/* Idle — the empty specimen mount, awaiting an image */}
            {status === 'idle' && <UploadZone onFile={runFile} disabled={busy} />}

            {busy && <LoadingState imageSrc={imageSrc} />}

            {status === 'error' && (
              <div className="animate-settle-in overflow-hidden rounded-lg border border-alert/30 bg-alert/[0.06]">
                <div className="border-b border-alert/20 px-4 py-2.5">
                  <span className="micro-label text-alert">Xatolik</span>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-sm font-600 text-[#b0561f]">
                    Tahlil bajarilmadi
                  </p>
                  <p className="mt-1.5 text-sm text-ink-70">{error}</p>
                  <p className="mt-2 text-xs text-ink-40">
                    Backend (/predict) ishlayotganini va server ulanganini
                    tekshiring.
                  </p>
                </div>
              </div>
            )}

            {status === 'done' && result && (
              <ResultCard result={result} imageSrc={imageSrc} />
            )}
          </div>

          {/* Side rail — sample tray + referable note */}
          <aside className="space-y-5">
            <div className="rounded-lg border border-exam-200 bg-exam-0 p-4 shadow-control">
              <SampleGallery
                samples={samples}
                loading={samplesLoading}
                error={samplesError}
                onPick={runSample}
                activeId={activeSampleId}
                busy={busy}
              />
            </div>

            <div className="rounded-lg border border-exam-200 bg-exam-0 p-4">
              <div className="flex items-center gap-2 border-b border-exam-200 pb-2.5">
                <span className="micro-label text-ink-55">Eslatma</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-70">
                KoʻzNur mavjud skrining tarmog‘i uchun yordamchi vositadir.
              </p>
              <p className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-ink-70">
                <span className="num mt-px shrink-0 font-600 text-alert">≥2</span>
                <span>
                  <span className="font-600 text-ink">Referable DR</span> —
                  yo‘naltirilishi kerak bo‘lgan daraja (o‘rtacha yoki og‘irroq).
                </span>
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
