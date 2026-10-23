const DB_NAME = 'doctor_ds_db'
const DB_VERSION = 1
const STORE_NAME = 'doctor_templates'

function openDb() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null)
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.warn('Failed to open IndexedDB for doctor templates:', request.error)
      resolve(null)
    }
  })
}

/**
 * Check if the user has completed the first-time onboarding.
 */
export function hasCompletedOnboarding(userId) {
  if (typeof window === 'undefined' || !userId) return true
  return localStorage.getItem(`doctor_onboarded_${userId}`) === 'true'
}

/**
 * Mark first-time onboarding as completed for this user.
 */
export function markOnboardingCompleted(userId) {
  if (typeof window === 'undefined' || !userId) return
  localStorage.setItem(`doctor_onboarded_${userId}`, 'true')
}

/**
 * Retrieve the active doctor template preference from IndexedDB.
 * Returns { mode: 'standard' | 'custom', files: File[], filename?: string, updatedAt?: string }
 */
export async function getDoctorTemplate(userId) {
  if (!userId) return { mode: 'standard', files: [] }

  const db = await openDb()
  if (!db) {
    // Fallback: check localStorage for mode if IndexedDB is unavailable
    const mode = localStorage.getItem(`doctor_template_mode_${userId}`) || 'standard'
    return { mode, files: [] }
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(userId)

      req.onsuccess = () => {
        const record = req.result
        if (!record) {
          resolve({ mode: 'standard', files: [] })
          return
        }

        // Reconstruct genuine File objects from stored blobs
        const reconstructedFiles = (record.files || []).map((item) => {
          if (item instanceof File) return item
          const blob = item.blob || item
          const name = item.name || 'template'
          const type = item.type || 'application/octet-stream'
          return new File([blob], name, { type })
        })

        resolve({
          mode: record.mode || 'standard',
          files: reconstructedFiles,
          filename: record.filename || (reconstructedFiles[0]?.name ?? ''),
          fileCount: reconstructedFiles.length,
          cloudSynced: Boolean(record.cloudSynced),
          updatedAt: record.updatedAt || null,
        })
      }

      req.onerror = () => {
        resolve({ mode: 'standard', files: [] })
      }
    } catch (err) {
      console.warn('Error reading doctor template from IndexedDB:', err)
      resolve({ mode: 'standard', files: [] })
    }
  })
}

/**
 * Save doctor template preference to IndexedDB.
 * @param {string} userId
 * @param {{ mode: 'standard' | 'custom', files?: File[], filename?: string, cloudSynced?: boolean }} payload
 */
export async function saveDoctorTemplate(userId, { mode = 'standard', files = [], filename = '', cloudSynced = false }) {
  if (!userId) return

  // Also cache mode in localStorage for immediate sync checks
  if (typeof window !== 'undefined') {
    localStorage.setItem(`doctor_template_mode_${userId}`, mode)
    if (mode === 'custom' && (filename || files[0]?.name)) {
      localStorage.setItem(`doctor_template_name_${userId}`, filename || files[0].name)
    } else {
      localStorage.removeItem(`doctor_template_name_${userId}`)
    }
  }

  const db = await openDb()
  if (!db) return

  const filePayload = (files || []).map((f) => ({
    name: f.name,
    type: f.type,
    size: f.size,
    blob: f,
  }))

  const resolvedFilename = filename || (files[0]?.name ?? '')

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const record = {
        userId,
        mode,
        files: filePayload,
        filename: resolvedFilename,
        cloudSynced: Boolean(cloudSynced),
        updatedAt: new Date().toISOString(),
      }

      const req = store.put(record)
      req.onsuccess = () => resolve(record)
      req.onerror = () => reject(req.error)
    } catch (err) {
      console.warn('Error saving doctor template to IndexedDB:', err)
      resolve(null)
    }
  })
}

/**
 * Mark custom template as successfully synced to Cloud R2.
 */
export async function markTemplateCloudSynced(userId) {
  if (!userId) return false
  const db = await openDb()
  if (!db) return false

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(userId)
      req.onsuccess = () => {
        const record = req.result
        if (record && record.mode === 'custom') {
          record.cloudSynced = true
          record.updatedAt = new Date().toISOString()
          store.put(record)
        }
        resolve(true)
      }
      req.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Clear doctor template back to standard institutional format.
 */
export async function clearDoctorTemplate(userId) {
  if (!userId) return
  return saveDoctorTemplate(userId, { mode: 'standard', files: [], filename: '', cloudSynced: false })
}
