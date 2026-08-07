import { API_BASE_URL, USER_ID } from '../config.js'

async function parseError(res) {
  const data = await res.json().catch(() => ({}))
  const detail =
    typeof data.detail === 'string'
      ? data.detail
      : Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg ?? JSON.stringify(item)).join('; ')
        : `Request failed (${res.status})`
  throw new Error(detail)
}

function parseFilename(disposition) {
  const match = (disposition || '').match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)
  if (!match) return null
  try {
    return decodeURIComponent(match[1].trim())
  } catch {
    return match[1].trim()
  }
}

export function editSummaryPath(userId, patientId, extractionId) {
  return `/edit/${userId}/${patientId}/${extractionId}`
}

export async function fetchExtractionDocx(userId, patientId, extractionId) {
  const res = await fetch(
    `${API_BASE_URL}/extractions/${userId}/${patientId}/${extractionId}/discharge-summary.docx`,
  )

  if (!res.ok) {
    await parseError(res)
  }

  const docxBlob = await res.blob()
  const filename =
    parseFilename(res.headers.get('Content-Disposition')) ?? 'discharge-summary.docx'

  return { docxBlob, filename }
}

export async function extractToDocx({ userId = USER_ID, files, patientId = null }) {
  const form = new FormData()
  form.append('user_id', userId)
  if (patientId) {
    form.append('patient_id', patientId)
  }
  for (const file of files) {
    form.append('files', file)
  }

  const res = await fetch(`${API_BASE_URL}/extract`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    await parseError(res)
  }

  const patientIdOut = res.headers.get('X-Patient-Id')
  const extractionId = res.headers.get('X-Extraction-Id')
  const docxBlob = await res.blob()
  const filename = parseFilename(res.headers.get('Content-Disposition')) ?? 'discharge-summary.docx'

  return { patientId: patientIdOut, extractionId, docxBlob, filename }
}

export async function convertDocxToPdf(docxFile) {
  const form = new FormData()
  form.append('file', docxFile)

  const res = await fetch(`${API_BASE_URL}/convert/docx-to-pdf`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    await parseError(res)
  }

  return res.blob()
}

export async function fetchContextJson(userId, patientId, extractionId) {
  const res = await fetch(
    `${API_BASE_URL}/extractions/${userId}/${patientId}/${extractionId}/context.json`,
  )
  if (!res.ok) {
    throw new Error('Context not found')
  }
  return res.json()
}
