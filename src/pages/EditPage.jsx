import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDischargeSummaryDocx } from '../api/dischargeApi.js'
import DocxSummaryEditor from '../components/DocxSummaryEditor.jsx'
import EditSummaryHeader from '../components/EditSummaryHeader.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'

export default function EditPage() {
  const { userId, patientId } = useParams()
  const [docxBlob, setDocxBlob] = useState(null)
  const [filename, setFilename] = useState('discharge-summary.docx')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      setLoading(true)
      setError(null)
      setNotFound(false)
      setDocxBlob(null)

      try {
        const { blob, filename: loadedFilename } = await fetchDischargeSummaryDocx(
          userId,
          patientId,
        )
        if (cancelled) return

        setDocxBlob(blob)
        setFilename(loadedFilename)
      } catch (err) {
        if (cancelled) return

        if (err instanceof Error && err.status === 404) {
          setNotFound(true)
        } else {
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
  }, [userId, patientId])

  const showEditor = !loading && !notFound && !error && docxBlob

  return (
    <div className="min-h-svh bg-slate-50">
      {showEditor ? (
        <DocxSummaryEditor
          documentBlob={docxBlob}
          fileName={filename}
          userId={userId}
          patientId={patientId}
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

            {notFound && !loading && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center">
                <p className="text-sm font-medium text-amber-900">Summary not found</p>
                <p className="mt-1 text-sm text-amber-800">
                  This link may be invalid or the summary was never generated.
                </p>
                <Link
                  to="/"
                  className="mt-4 inline-block rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700"
                >
                  Upload documents
                </Link>
              </div>
            )}

            <ErrorAlert message={error} onDismiss={() => setError(null)} />
          </main>
        </>
      )}
    </div>
  )
}
