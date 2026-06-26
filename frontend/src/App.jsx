import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import UploadZone from './components/UploadZone.jsx'
import SampleGallery from './components/SampleGallery.jsx'
import LoadingState from './components/LoadingState.jsx'
import ResultCard from './components/ResultCard.jsx'
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

  const [imageSrc, setImageSrc] = useState(null) // preview of the analyzed image
  const [activeSampleId, setActiveSampleId] = useState(null)

  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const objectUrlRef = useRef(null)
  const resultRef = useRef(null)

  // Revoke any object URL we created for the preview.
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

  // Health probe + sample gallery load on mount.
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

  // Scroll the result into view once it lands.
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
    setImageSrc(resolveUrl(sample.thumb ? sample.url : sample.url))
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header healthy={healthy} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
        {/* Intro */}
        <section className="mb-8 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy/70">
            Diabetik retinopatiya · ICDR 0–4
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">
            Fundus rasmni soniyalarda baholang
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-navy/65 sm:text-base">
            Ko‘z tubi suratini yuklang — KoʻzNur darajani aniqlaydi, mutaxassis
            ko‘rigiga yo‘naltirish kerakligini belgilaydi va model e’tibor bergan
            hududlarni Grad-CAM xaritasida ko‘rsatadi.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Primary column */}
          <div className="space-y-6" ref={resultRef}>
            {status === 'idle' && <UploadZone onFile={runFile} disabled={busy} />}

            {(status === 'done' || status === 'error' || busy) && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-navy/70">
                  {busy
                    ? 'Tahlil davom etmoqda'
                    : status === 'error'
                      ? 'Tahlil bajarilmadi'
                      : 'Tayyor natija'}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-navy-50 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 5v5h5M20 19v-5h-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 9a7 7 0 0 0-12.9-2.5M5 15a7 7 0 0 0 12.9 2.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  Yangi rasm
                </button>
              </div>
            )}

            {busy && <LoadingState imageSrc={imageSrc} />}

            {status === 'error' && (
              <div className="animate-fade-in-up rounded-2xl border border-accent-200 bg-accent-50 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-accent-700">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="16.2" r="1" fill="currentColor" />
                  </svg>
                  Tahlil bajarilmadi
                </p>
                <p className="mt-1.5 text-sm text-navy/70">{error}</p>
                <p className="mt-1 text-xs text-navy/50">
                  Backend ({/* shown for debugging */}/predict) ishlayotganini va
                  server ulanganini tekshiring.
                </p>
              </div>
            )}

            {status === 'done' && result && (
              <ResultCard result={result} imageSrc={imageSrc} />
            )}
          </div>

          {/* Side column — sample gallery */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-navy/10 bg-white p-4 shadow-soft sm:p-5">
              <SampleGallery
                samples={samples}
                loading={samplesLoading}
                error={samplesError}
                onPick={runSample}
                activeId={activeSampleId}
                busy={busy}
              />
            </div>

            <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Eslatma
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-navy/65">
                KoʻzNur mavjud skrining tarmog‘i uchun yordamchi vositadir.
                <span className="font-semibold text-navy"> Referable DR</span>{' '}
                (yo‘naltirilishi kerak) — bu daraja ≥ 2 (o‘rtacha yoki og‘irroq).
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
