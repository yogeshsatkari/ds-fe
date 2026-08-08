import { useCallback, useState } from 'react'

const STORAGE_KEY = 'ds-session'

const emptyState = {
  patientId: null,
  filename: null,
}

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw)
    return { ...emptyState, ...parsed }
  } catch {
    return emptyState
  }
}

function persist(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // sessionStorage unavailable or quota exceeded
  }
}

export function useSession() {
  const [session, setSession] = useState(readStored)

  const update = useCallback((patch) => {
    setSession((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSession(emptyState)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return { session, update, reset }
}
