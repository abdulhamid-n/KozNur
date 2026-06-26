// KoʻzNur API client.
// Backend contract: ARCHITECTURE.md §5.
//   POST /predict   multipart image  -> PredictResult JSON
//   GET  /samples   -> curated demo fundus images
//   GET  /health    -> liveness
//
// Base URL is fixed to the local FastAPI dev server per the brief, but
// can be overridden at build time via VITE_API_BASE.

// If VITE_API_BASE is defined (even as ""), use it verbatim. Empty string ""
// means same-origin/relative requests (/predict, /samples) — used for the
// single-origin tunnel/prod build. Unset -> local dev default.
export const API_BASE =
  import.meta.env && import.meta.env.VITE_API_BASE != null
    ? import.meta.env.VITE_API_BASE
    : 'http://localhost:8000'

/**
 * @typedef {Object} PredictResult
 * @property {number} grade               ICDR grade 0–4
 * @property {string} grade_label         e.g. "Moderate"
 * @property {boolean} referable          grade >= 2
 * @property {number} confidence          0..1
 * @property {number[]} probabilities     softmax over 5 grades
 * @property {string} gradcam_png_base64  base64 PNG of the Grad-CAM overlay
 * @property {string} recommendation      plain-language Uzbek referral text
 */

/**
 * Resolve a possibly-relative sample URL against the API base.
 * @param {string} url
 * @returns {string}
 */
export function resolveUrl(url) {
  if (!url) return url
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Normalize a base64 Grad-CAM payload into a usable <img> src.
 * Accepts a bare base64 string or an already-prefixed data URI.
 * @param {string} b64
 * @returns {string|null}
 */
export function gradcamSrc(b64) {
  if (!b64) return null
  if (b64.startsWith('data:')) return b64
  return `data:image/png;base64,${b64}`
}

async function parseJsonOrThrow(res) {
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error(
      `Serverdan kutilmagan javob (HTTP ${res.status}). JSON kutilgan edi.`
    )
  }
  if (!res.ok) {
    const detail =
      (body && (body.detail || body.message || body.error)) ||
      `So'rov muvaffaqiyatsiz tugadi (HTTP ${res.status}).`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return body
}

/**
 * Grade a fundus image file.
 * @param {File|Blob} file
 * @returns {Promise<PredictResult>}
 */
export async function predict(file) {
  const form = new FormData()
  // FastAPI UploadFile param is conventionally named "file".
  form.append('file', file, file.name || 'fundus.jpg')
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    body: form,
  })
  return parseJsonOrThrow(res)
}

/**
 * Run prediction on a curated sample by its id/path.
 * Falls back to fetching the sample image and POSTing it to /predict
 * if the backend has no dedicated sample-predict route.
 * @param {{id?: string, url: string, name?: string}} sample
 * @returns {Promise<PredictResult>}
 */
export async function predictSample(sample) {
  // Preferred path: a backend endpoint that runs a known sample by id.
  if (sample && sample.id != null) {
    try {
      const res = await fetch(
        `${API_BASE}/predict/sample/${encodeURIComponent(sample.id)}`,
        { method: 'POST' }
      )
      if (res.ok) return parseJsonOrThrow(res)
      // 404/405 -> fall through to client-side fetch+upload.
    } catch {
      // network issue on the optional route -> fall through
    }
  }

  // Fallback: fetch the image bytes and send them through /predict.
  const imgUrl = resolveUrl(sample.url)
  const imgRes = await fetch(imgUrl)
  if (!imgRes.ok) {
    throw new Error(`Namuna rasmni yuklab bo'lmadi (HTTP ${imgRes.status}).`)
  }
  const blob = await imgRes.blob()
  const fname = sample.name || (sample.url || 'sample.jpg').split('/').pop()
  const fileLike =
    typeof File !== 'undefined'
      ? new File([blob], fname, { type: blob.type || 'image/jpeg' })
      : blob
  return predict(fileLike)
}

/**
 * Load the curated demo gallery.
 * @returns {Promise<Array<{id?: string, url: string, name?: string, grade?: number}>>}
 */
export async function getSamples() {
  const res = await fetch(`${API_BASE}/samples`)
  const data = await parseJsonOrThrow(res)
  // Tolerate a few reasonable shapes: [...], {samples: [...]}, {items: [...]}.
  const list = Array.isArray(data)
    ? data
    : (data && (data.samples || data.items || data.data)) || []
  return list.map((s, i) => normalizeSample(s, i))
}

function normalizeSample(s, i) {
  if (typeof s === 'string') {
    return { id: String(i), url: s, name: s.split('/').pop() }
  }
  const url = s.url || s.image || s.image_url || s.path || s.src || ''
  const grade =
    typeof s.grade === 'number'
      ? s.grade
      : typeof s.expected_grade === 'number'
        ? s.expected_grade
        : undefined
  return {
    id: s.id != null ? String(s.id) : String(i),
    url,
    name: s.name || s.label || s.title || (url ? url.split('/').pop() : `Namuna ${i + 1}`),
    grade,
    referable: typeof s.referable === 'boolean' ? s.referable : undefined,
    thumb: s.thumb || s.thumbnail || undefined,
  }
}

/**
 * Lightweight health probe.
 * @returns {Promise<boolean>}
 */
export async function getHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}
