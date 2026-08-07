import { useState } from 'react'
import { IMAGE_ACCEPT, MAX_IMAGES, USER_ID } from '../config.js'
import { extractToDocx } from '../api/dischargeApi.js'
import { useSession } from '../hooks/useSession.js'
import FileDropzone from '../components/FileDropzone.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import DocxSummaryEditor from '../components/DocxSummaryEditor.jsx'

function truncateId(id) {
  if (!id) return ''
  return `${id.slice(0, 8)}…`
}

export default function HomePage() {
  const { session, update, reset } = useSession()
  const [imageFiles, setImageFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleAddImages = (files) => {
    setImageFiles((prev) => [...prev, ...files].slice(0, MAX_IMAGES))
    setError(null)
  }

  const handleRemoveImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStartOver = () => {
    reset()
    setImageFiles([])
    setResult(null)
    setError(null)
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!imageFiles.length) return
    if (!USER_ID) {
      setError('Missing user ID. Set VITE_PLACEHOLDER_USER_ID in your .env file.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await extractToDocx({
        files: imageFiles,
        patientId: session.patientId,
      })

      update({
        patientId: data.patientId,
        extractionId: data.extractionId,
        filename: data.filename,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                Discharge Summary
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Upload patient documents to generate and edit your discharge summary
              </p>
            </div>
            {(result || session.patientId) && (
              <button
                type="button"
                onClick={handleStartOver}
                disabled={loading}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Patient documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              Clinical notes, labs, and scans. Order matters — first file = page 1. Max{' '}
              {MAX_IMAGES} images.
            </p>
          </div>

          {!loading && (
            <FileDropzone
              accept={IMAGE_ACCEPT}
              multiple
              label="Patient document images"
              hint="JPG, PNG, TIFF, BMP"
              disabled={loading || imageFiles.length >= MAX_IMAGES}
              onFiles={handleAddImages}
            />
          )}

          {imageFiles.length > 0 && !loading && (
            <ol className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {imageFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="text-slate-600">
                    <span className="font-mono text-xs text-slate-400 mr-2">{index + 1}.</span>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}

          {loading && (
            <LoadingPanel
              title="Generating discharge summary…"
              message="Processing images and filling the summary. This usually takes 1–3 minutes."
              warning="Please don't close this tab until generation completes."
            />
          )}

          <ErrorAlert message={error} onDismiss={() => setError(null)} />

          {!loading && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!imageFiles.length || loading}
                className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate summary
              </button>
              {session.patientId && !result && (
                <p className="text-xs text-slate-500">
                  Re-using patient {truncateId(session.patientId)}
                </p>
              )}
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="rounded-lg border border-clinical-200 bg-clinical-50 px-4 py-3 text-sm">
                <p className="font-medium text-clinical-800">Summary ready</p>
                <p className="mt-1 text-xs text-clinical-700">
                  {result.filename} · Patient {truncateId(result.patientId)} · Extraction{' '}
                  {truncateId(result.extractionId)}
                </p>
              </div>

              <DocxSummaryEditor documentBlob={result.docxBlob} fileName={result.filename} />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
