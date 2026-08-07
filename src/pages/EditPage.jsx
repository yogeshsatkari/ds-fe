import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDischargeSummaryDocx } from '../api/dischargeApi.js'
import DocxSummaryEditor from '../components/DocxSummaryEditor.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'

export default function EditPage() {
  const { userId, patientId, extractionId } = useParams()
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
          extractionId,
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
  }, [userId, patientId, extractionId])

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                Edit discharge summary
              </h1>
              {!loading && !notFound && (
                <p className="mt-0.5 text-sm text-slate-500">{filename}</p>
              )}
            </div>
            <Link
              to="/"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              New summary
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
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

        {!loading && !notFound && !error && docxBlob && (
          <DocxSummaryEditor
            documentBlob={docxBlob}
            fileName={filename}
            userId={userId}
            patientId={patientId}
            extractionId={extractionId}
          />
        )}
      </main>
    </div>
  )
}
