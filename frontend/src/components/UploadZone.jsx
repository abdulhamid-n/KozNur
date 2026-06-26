import { useCallback, useRef, useState } from 'react'

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp'

export default function UploadZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const pick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleFiles = useCallback(
    (files) => {
      if (disabled) return
      const file = files && files[0]
      if (!file) return
      if (!file.type.startsWith('image/')) return
      onFile(file)
    },
    [onFile, disabled]
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setDragging(false)
      }}
      onDrop={onDrop}
      onClick={pick}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label="Fundus rasmni yuklash"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      }}
      className={[
        'group relative flex min-h-[360px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border bg-shell-900 px-6 py-16 text-center transition-all sm:min-h-[440px]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-instrument/60',
        disabled ? 'cursor-not-allowed opacity-60' : '',
        dragging
          ? 'border-instrument'
          : 'border-dashed border-white/15 hover:border-instrument/60',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* crosshair guides */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.10]" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-full w-px bg-instrument" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-instrument" />
      </div>

      {/* corner ticks */}
      <div className="pointer-events-none absolute inset-3" aria-hidden="true">
        {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map(
          (c, i) => (
            <span
              key={i}
              className={`absolute h-5 w-5 border-instrument/50 ${c} transition-colors ${dragging ? 'border-instrument' : ''}`}
            />
          )
        )}
      </div>

      <div
        className={[
          'mb-4 flex h-14 w-14 items-center justify-center rounded-full border transition-colors',
          dragging
            ? 'border-instrument bg-instrument/15 text-instrument'
            : 'border-white/15 text-white/60 group-hover:border-instrument/50 group-hover:text-instrument',
        ].join(' ')}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 16V5m0 0L8 9m4-4 4 4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="font-display text-base font-600 text-exam-50">
        Fundus rasmni mountga tashlang
      </p>
      <p className="mt-1.5 text-sm text-white/55">
        yoki{' '}
        <span className="font-600 text-instrument underline decoration-instrument/40 underline-offset-2">
          fayl tanlang
        </span>
      </p>
      <p className="micro-label mt-4 text-white/35">PNG · JPG · WEBP</p>
    </div>
  )
}
