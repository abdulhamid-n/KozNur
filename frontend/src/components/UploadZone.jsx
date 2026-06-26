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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          pick()
        }
      }}
      className={[
        'group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all',
        disabled ? 'cursor-not-allowed opacity-60' : '',
        dragging
          ? 'border-teal-600 bg-teal-50/70 ring-4 ring-teal-100'
          : 'border-navy/20 bg-white hover:border-teal-600/60 hover:bg-teal-50/30',
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

      <div
        className={[
          'mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors',
          dragging ? 'bg-teal-600 text-white' : 'bg-navy-50 text-navy group-hover:bg-teal-50 group-hover:text-teal-700',
        ].join(' ')}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 16V5m0 0L8 9m4-4 4 4"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="text-base font-semibold text-navy">
        Fundus rasmni bu yerga tashlang
      </p>
      <p className="mt-1 text-sm text-navy/60">
        yoki{' '}
        <span className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2">
          fayl tanlash uchun bosing
        </span>
      </p>
      <p className="mt-3 text-xs text-navy/45">PNG, JPG yoki WEBP · retinal (ko‘z tubi) surat</p>
    </div>
  )
}
