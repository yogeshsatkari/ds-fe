import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { fetchExtractionDocx } from '../api/dischargeApi.js'
import { loadExtractionDocx } from '../utils/extractionStore.js'
import DocxSummaryEditor from '../components/DocxSummaryEditor.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'

export default function EditPage() {
  const { userId, patientId, extractionId } = useParams()
  const location = useLocation()
  const [docxBlob, setDocxBlob] = useState(location.state?.docxBlob ?? null)
  const [filename, setFilename] = useState(location.state?.filename ?? 'discharge-summary.docx')
  const [loading, setLoading] = useState(!location.state?.docxBlob)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (location.state?.docxBlob) {
      return
    }

    let cancelled = false

    async function loadDocument() {
      setLoading(true)
      setError(null)

      try {
        const cached = await loadExtractionDocx(userId, patientId, extractionId)
        if (cancelled) return

        if (cached?.blob) {
          setDocxBlob(cached.blob)
          setFilename(cached.filename ?? 'discharge-summary.docx')
          return
        }

        const remote = await fetchExtractionDocx(userId, patientId, extractionId)
        if (cancelled) return

        setDocxBlob(remote.docxBlob)
        setFilename(remote.filename)
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
  }, [userId, patientId, extractionId, location.state])

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                Edit discharge summary
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">{filename}</p>
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

        <ErrorAlert message={error} onDismiss={() => setError(null)} />

        {!loading && !error && docxBlob && (
          <DocxSummaryEditor documentBlob={docxBlob} fileName={filename} />
        )}
      </main>
    </div>
  )
}
