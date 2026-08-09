import { useEffect, useState } from 'react'
import sampleDocxUrl from '../../discharge-summary.docx?url'
import DocxSummaryEditor from '../components/DocxSummaryEditor.jsx'
import EditSummaryHeader from '../components/EditSummaryHeader.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'

const FILE_NAME = 'discharge-summary.docx'

export default function DevEditPage() {
  const [docxBlob, setDocxBlob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      setLoading(true)
      setError(null)
      setDocxBlob(null)

      try {
        const response = await fetch(sampleDocxUrl)
        if (!response.ok) {
          throw new Error(`Failed to load ${FILE_NAME} (${response.status})`)
        }
        const blob = await response.blob()
        if (!cancelled) {
          setDocxBlob(blob)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load discharge summary for this link.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      cancelled = true
    }
  }, [])

  const showEditor = !loading && !error && docxBlob

  return (
    <div className="min-h-svh bg-slate-50">
      {showEditor ? (
        <DocxSummaryEditor
          documentBlob={docxBlob}
          fileName={FILE_NAME}
          userId="dev-user"
          patientId="dev-patient"
        />
      ) : (
        <>
          <EditSummaryHeader />
          <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
            {loading && (
              <LoadingPanel
                title="Loading discharge summary…"
                message="Opening the document in the editor."
              />
            )}

            <ErrorAlert message={error} onDismiss={() => setError(null)} />
          </main>
        </>
      )}
    </div>
  )
}
