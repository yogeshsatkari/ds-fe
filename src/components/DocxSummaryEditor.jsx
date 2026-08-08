import { useEffect, useRef, useState } from 'react'
import { DocxEditor } from '@docx-editor.dev/react'
import { convertDocxToPdf } from '../api/dischargeApi.js'
import EditSummaryHeader from './EditSummaryHeader.jsx'
import DownloadActions from './DownloadActions.jsx'
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

  const downloads = (
    <DownloadActions
      onDownloadDocx={handleDownloadDocx}
      onDownloadPdf={handleDownloadPdf}
      downloading={downloading}
      convertingPdf={convertingPdf}
      disabled={!documentBytes}
    />
  )

  return (
    <div className="docx-summary-editor">
      <EditSummaryHeader downloads={downloads} />

      <div className="mx-auto max-w-7xl space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        <ErrorAlert message={actionError} onDismiss={() => setActionError(null)} />

        <div className="docx-summary-editor__surface docx-editor-print-area rounded-lg border border-slate-200 bg-white">
          {documentBytes && (
            <DocxEditor
              ref={editorRef}
              document={documentBytes}
              mode="edit"
              title=""
            />
          )}
        </div>
      </div>
    </div>
  )
}
