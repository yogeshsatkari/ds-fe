import { useCallback, useState } from 'react'

const STORAGE_KEY = 'ds-workflow-state'

const emptyState = {
  templateId: null,
  templateViewUrl: null,
  patientId: null,
  extractionId: null,
  summaryId: null,
  summaryViewUrl: null,
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

export function useWorkflow() {
  const [workflow, setWorkflow] = useState(readStored)

  const update = useCallback((patch) => {
    setWorkflow((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setWorkflow(emptyState)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return { workflow, update, reset }
}
