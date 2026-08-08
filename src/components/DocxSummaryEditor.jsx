import { useEffect, useRef, useState } from 'react'
import { DocxEditor } from '@docx-editor.dev/react'
import { convertDocxToPdf } from '../api/dischargeApi.js'
import LoadingPanel from './LoadingPanel.jsx'
import ErrorAlert from './ErrorAlert.jsx'
import { downloadBlob } from '../utils/downloadBlob.js'
import './DocxSummaryEditor.css'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export default function DocxSummaryEditor({
  documentBlob,
  fileName = 'discharge-summary.docx',
  userId,
  patientId,
}) {
  const editorRef = useRef(null)
  const [documentBytes, setDocumentBytes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [convertingPdf, setConvertingPdf] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      if (!documentBlob) {
        setDocumentBytes(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError(null)
      setDocumentBytes(null)

      try {
        const buffer = await documentBlob.arrayBuffer()
        if (!cancelled) {
          setDocumentBytes(new Uint8Array(buffer))
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load document')
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
  }, [documentBlob])

  const handleDownloadDocx = async () => {
    setActionError(null)
    setDownloading(true)
    try {
      const buffer = await editorRef.current?.save()
      if (!buffer) {
        throw new Error('Nothing to save yet. Wait for the editor to finish loading.')
      }
      downloadBlob(new Blob([buffer], { type: DOCX_MIME }), fileName)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadPdf = async () => {
    setActionError(null)
    setConvertingPdf(true)
    try {
      const buffer = await editorRef.current?.save()
      if (!buffer) {
        throw new Error('Nothing to save yet. Wait for the editor to finish loading.')
      }
      const docxFile = new File([buffer], fileName, { type: DOCX_MIME })
      const { pdfBlob, filename } = await convertDocxToPdf(docxFile, {
        userId,
        patientId,
      })
      downloadBlob(pdfBlob, filename)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'PDF conversion failed')
    } finally {
      setConvertingPdf(false)
    }
  }

  if (loading) {
    return (
      <LoadingPanel
        title="Loading document…"
        message="Opening the discharge summary in the editor."
      />
    )
  }

  if (loadError) {
    return <ErrorAlert message={loadError} />
  }

  return (
    <div className="docx-summary-editor space-y-3">
      <div className="docx-summary-editor__actions flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadDocx}
          disabled={downloading || convertingPdf || !documentBytes}
          className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? 'Preparing…' : 'Download DOCX'}
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloading || convertingPdf || !documentBytes}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {convertingPdf ? 'Converting…' : 'Download PDF'}
        </button>
      </div>

      <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />

      <div className="docx-summary-editor__surface docx-editor-print-area rounded-lg border border-slate-200 bg-white">
        {documentBytes && (
          <DocxEditor
            ref={editorRef}
            document={documentBytes}
            mode="edit"
            title={fileName.replace(/\.docx$/i, '')}
          />
        )}
      </div>
    </div>
  )
}
