import { API_BASE_URL, getStoredUserId } from '../config.js'

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
  userId = getStoredUserId(),
  files,
  templateFiles = [],
  patientId = null,
  dischargeType = null,
}) {
  const form = new FormData()
  form.append('user_id', userId)
  if (patientId) {
    form.append('patient_id', patientId)
  }
  for (const file of files) {
    form.append('files', file)
  }

  if (templateFiles && templateFiles.length > 0) {
    form.append('discharge_type', 'custom')
    for (const tFile of templateFiles) {
      form.append('template_files', tFile)
    }
  } else {
    form.append('discharge_type', dischargeType || 'standard')
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

export async function convertDocxToPdf(docxFile, { userId = getStoredUserId(), patientId }) {
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

export async function fetchUserPatients(userId = getStoredUserId()) {
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

export async function fetchTemplateMd(userId, patientId) {
  if (!userId || !patientId) return null
  try {
    const res = await fetch(
      `${API_BASE_URL}/extractions/${userId}/${patientId}/template.md`,
    )
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export function getActiveUserId() {
  return getStoredUserId()
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

export async function fetchUserTemplate(userId) {
  if (!userId) return null
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/template`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

let pendingCloudTemplateSync = null

export function getActiveTemplateSyncPromise() {
  return pendingCloudTemplateSync
}

export async function saveUserTemplateToCloud(userId, files) {
  if (!userId || !files?.length) return null
  const form = new FormData()
  for (const f of files) {
    form.append('template_files', f)
  }

  const syncPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/template`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.detail || `Upload failed (${res.status})`)
      }
      return await res.json()
    } finally {
      if (pendingCloudTemplateSync === syncPromise) {
        pendingCloudTemplateSync = null
      }
    }
  })()

  pendingCloudTemplateSync = syncPromise
  return syncPromise
}

export async function deleteUserTemplateFromCloud(userId) {
  if (!userId) return null
  const res = await fetch(`${API_BASE_URL}/users/${userId}/template`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail || `Delete failed (${res.status})`)
  }
  return res.json()
}

export async function downloadDoctorTemplateFile(userId) {
  if (!userId) throw new Error('Missing user ID')
  const res = await fetch(`${API_BASE_URL}/users/${userId}/template/file`)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail || 'Template file not found')
  }
  const blob = await res.blob()
  const filename = parseFilename(res.headers.get('Content-Disposition')) || 'template'
  return { blob, filename }
}

// Aliases matching backend specification
export const getDoctorTemplateCloud = fetchUserTemplate
export const uploadDoctorTemplate = saveUserTemplateToCloud
export const deleteDoctorTemplate = deleteUserTemplateFromCloud

/**
 * Persist doctor phone and PIN to R2 under users/{user_id}/metadata.json
 */
export async function saveDoctorMetadataToCloud(userId, { phone, pin }) {
  if (!userId) return null
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone ? String(phone).replace(/\D/g, '').slice(-10) : '',
        pin: pin ? String(pin).trim() : '',
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.warn('Failed to save doctor metadata to cloud:', err)
    return null
  }
}

/**
 * Fetch doctor profile metadata from R2 (users/{user_id}/metadata.json)
 */
export async function fetchDoctorMetadataFromCloud(userId) {
  if (!userId) return null
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/metadata`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}




