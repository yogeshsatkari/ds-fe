import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FILE_ACCEPT, MAX_FILES, MAX_TOTAL_SIZE_MB, USER_ID } from '../config.js'
import {
  editSummaryPath,
  extractToDocx,
  fetchUserPatients,
} from '../api/dischargeApi.js'
import { useSession } from '../hooks/useSession.js'
import FileDropzone from '../components/FileDropzone.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import PastPatientsList from '../components/PastPatientsList.jsx'

import { compressImage } from '../utils/compressImage.js'

function FilePreviewItem({ file, index, onRemove }) {
  const isPdf =
    file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!isPdf && file.type?.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isPdf])

  const fileSize =
    file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-xs text-slate-400">{index + 1}.</span>
        {isPdf ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600">
            PDF
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="h-9 w-9 shrink-0 rounded border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600">
            IMG
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
          <p className="text-xs text-slate-400">
            {fileSize} · {isPdf ? 'PDF document' : 'Optimized image'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="shrink-0 cursor-pointer rounded px-2 py-0.5 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        Remove
      </button>
    </li>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { update } = useSession()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [error, setError] = useState(null)
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(Boolean(USER_ID))
  const [patientsError, setPatientsError] = useState(null)

  useEffect(() => {
    if (!USER_ID) {
      setPatients([])
      setPatientsLoading(false)
      return
    }

    let cancelled = false

    async function loadPatients() {
      setPatientsLoading(true)
      setPatientsError(null)
      try {
        const list = await fetchUserPatients(USER_ID)
        if (!cancelled) {
          setPatients(list)
        }
      } catch (err) {
        if (!cancelled) {
          setPatients([])
          setPatientsError(err instanceof Error ? err.message : 'Failed to load patients')
        }
      } finally {
        if (!cancelled) {
          setPatientsLoading(false)
        }
      }
    }

    loadPatients()

    return () => {
      cancelled = true
    }
  }, [])

  const handleAddFiles = async (newFiles) => {
    setError(null)
    setOptimizing(true)

    try {
      // Automatically optimize images in background (PDFs remain untouched)
      const processedFiles = await Promise.all(
        newFiles.map((file) => compressImage(file)),
      )

      const combined = [...files, ...processedFiles].slice(0, MAX_FILES)
      const totalBytes = combined.reduce((sum, file) => sum + (file.size || 0), 0)
      const maxBytes = MAX_TOTAL_SIZE_MB * 1024 * 1024

      if (totalBytes > maxBytes) {
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(1)
        setError(
          `Total file size (${totalMB} MB) exceeds the ${MAX_TOTAL_SIZE_MB} MB limit. Please remove some files.`,
        )
        return
      }

      setFiles(combined)
    } catch (err) {
      console.error('File optimization error:', err)
      // Fallback to original files on unexpected error
      setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES))
    } finally {
      setOptimizing(false)
    }
  }

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const handleGenerate = async () => {
    if (!files.length) return
    if (!USER_ID) {
      setError('Missing user ID. Set VITE_PLACEHOLDER_USER_ID in your .env file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await extractToDocx({
        files,
      })

      update({
        patientId: data.patientId,
        filename: data.filename,
      })

      navigate(editSummaryPath(USER_ID, data.patientId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setLoading(false)
    }
  }

  const handleOpenPatient = (patient) => {
    if (!USER_ID || !patient?.patient_id) return
    update({ patientId: patient.patient_id })
    navigate(editSummaryPath(USER_ID, patient.patient_id))
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Discharge Summary
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Upload clinical notes, labs, and documents to create a summary
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <svg className="h-4 w-4 text-clinical-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span>Analytics & Patients</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <section className="space-y-4">
          {!loading && (
            <FileDropzone
              accept={FILE_ACCEPT}
              multiple
              label={optimizing ? 'Optimizing documents…' : 'Add patient documents'}
              hint={`PDF, JPG, PNG, or TIFF (up to ${MAX_FILES} files, max ${MAX_TOTAL_SIZE_MB} MB total)`}
              disabled={loading || optimizing || files.length >= MAX_FILES}
              onFiles={handleAddFiles}
            />
          )}

          {files.length > 0 && !loading && (
            <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {files.map((file, index) => (
                <FilePreviewItem
                  key={`${file.name}-${index}`}
                  file={file}
                  index={index}
                  onRemove={handleRemoveFile}
                />
              ))}
            </ol>
          )}

          {loading && (
            <LoadingPanel
              title="Creating your summary…"
              message="This usually takes a minute. Keep this tab open."
            />
          )}

          <ErrorAlert message={error} onDismiss={() => setError(null)} />

          {!loading && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!files.length || loading || optimizing}
              className="w-full cursor-pointer rounded-md bg-clinical-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {optimizing ? 'Optimizing documents…' : 'Generate summary'}
            </button>
          )}

          {!loading && USER_ID && (
            <PastPatientsList
              patients={patients}
              loading={patientsLoading}
              error={patientsError}
              onSelect={handleOpenPatient}
            />
          )}
        </section>
      </main>
    </div>
  )
}
