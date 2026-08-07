const DB_NAME = 'ds-extractions'
const STORE = 'docx'
const DB_VERSION = 1

function storageKey(userId, patientId, extractionId) {
  return `${userId}/${patientId}/${extractionId}`
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

export async function saveExtractionDocx(userId, patientId, extractionId, blob, filename) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put({ blob, filename, savedAt: Date.now() }, storageKey(userId, patientId, extractionId))
  })
}

export async function loadExtractionDocx(userId, patientId, extractionId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(storageKey(userId, patientId, extractionId))
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}
