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

export function editSummaryPath(userId, patientId) {
  return `/edit/${userId}/${patientId}`
}

export async function fetchDischargeSummaryDocx(userId, patientId) {
  const res = await fetch(
    `${API_BASE_URL}/extractions/${userId}/${patientId}/discharge-summary.docx`,
  )

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : `Failed to load discharge summary (${res.status})`
    const error = new Error(detail)
    error.status = res.status
    throw error
  }

  const blob = await res.blob()
  const filename =
    parseFilename(res.headers.get('Content-Disposition')) ?? 'discharge-summary.docx'

  return { blob, filename }
}

export async function extractToDocx({
  userId = USER_ID,
  files,
  patientId = null,
  dischargeType = 'standard', // other value can be 'custom'
}) {
  const form = new FormData()
  form.append('user_id', userId)
  form.append('discharge_type', dischargeType)
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
  const docxBlob = await res.blob()
  const filename = parseFilename(res.headers.get('Content-Disposition')) ?? 'discharge-summary.docx'

  return { patientId: patientIdOut, docxBlob, filename }
}

export async function convertDocxToPdf(docxFile, { userId, patientId }) {
  const form = new FormData()
  form.append('file', docxFile)
  form.append('user_id', userId)
  form.append('patient_id', patientId)

  const res = await fetch(`${API_BASE_URL}/convert/docx-to-pdf`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    await parseError(res)
  }

  const pdfBlob = await res.blob()
  const filename =
    parseFilename(res.headers.get('Content-Disposition')) ?? 'discharge-summary.pdf'

  return { pdfBlob, filename }
}

export async function fetchUserPatients(userId = USER_ID) {
  if (!userId) {
    throw new Error('Missing user ID')
  }

  const res = await fetch(`${API_BASE_URL}/users/${userId}/patients`)
  if (!res.ok) {
    await parseError(res)
  }

  const data = await res.json()
  return data.patients ?? []
}

export async function fetchDischargeSummaryMd(userId, patientId) {
  const res = await fetch(
    `${API_BASE_URL}/extractions/${userId}/${patientId}/discharge-summary.md`,
  )
  if (!res.ok) {
    throw new Error('Discharge summary markdown not found')
  }
  return res.text()
}

export async function fetchPatientMetadata(userId, patientId) {
  const res = await fetch(
    `${API_BASE_URL}/extractions/${userId}/${patientId}/metadata.json`,
  )
  if (!res.ok) {
    throw new Error('Patient metadata not found')
  }
  return res.json()
}

export async function fetchContextJson(userId, patientId) {
  const res = await fetch(
    `${API_BASE_URL}/extractions/${userId}/${patientId}/context.json`,
  )
  if (!res.ok) {
    throw new Error('Context not found')
  }
  return res.json()
}

export function getActiveUserId() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('user_id')
    if (stored) return stored.trim()
  }
  return USER_ID
}

export async function fetchPatientMetrics(userId, patientId) {
  if (!userId || !patientId) return null
  try {
    const res = await fetch(
      `${API_BASE_URL}/extractions/${userId}/${patientId}/metrics.json`,
    )
    if (!res.ok) {
      return null
    }
    return await res.json()
  } catch {
    return null
  }
}


