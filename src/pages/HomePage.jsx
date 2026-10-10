import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FILE_ACCEPT, MAX_FILES, MAX_TOTAL_SIZE_MB, USER_ID } from '../config.js'
import {
  editSummaryPath,
  extractToDocx,
  fetchUserPatients,
} from '../api/dischargeApi.js'
import { useSession } from '../hooks/useSession.js'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import PastPatientsList from '../components/PastPatientsList.jsx'
import { compressImage } from '../utils/compressImage.js'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Fullscreen / modal preview to inspect full document before extraction.
 */
function DocumentLightboxModal({ file, index, total, onClose, onRemove, onNext, onPrev }) {
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && onNext) onNext()
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNext, onPrev])

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-6 items-center rounded-full bg-clinical-100 px-2 text-xs font-semibold text-clinical-700">
              Page {index + 1} of {total}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900">{file.name}</h2>
              <p className="text-xs text-slate-500">
                {formatBytes(file.size)} · {isPdf ? 'PDF Document' : 'Optimized Image'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onRemove(index)
                onClose()
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Remove</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close preview"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative flex min-h-[50vh] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
          {isPdf ? (
            <div className="flex flex-col items-center justify-center text-center p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-100 text-red-600 shadow-sm">
                <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="mt-3 text-base font-semibold text-slate-800">{file.name}</h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Multi-page PDF document ({formatBytes(file.size)}). All pages will be extracted by Gemini OCR in sequential order.
              </p>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-[75vh] w-auto max-w-full rounded-md object-contain shadow-md"
            />
          ) : (
            <div className="text-xs text-slate-400">Loading preview…</div>
          )}

          {/* Navigation Arrows */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                disabled={index === 0}
                className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-xs transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-30"
                title="Previous document"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={index === total - 1}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-xs transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-30"
                title="Next document"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Interactive square document tile (1-inch / 96px square, Anthropic/Google Photos style).
 */
function DocumentSquareTile({ file, index, onRemove, onPreviewClick }) {
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
  const [thumbnailUrl, setThumbnailUrl] = useState(null)

  useEffect(() => {
    if (!isPdf && file.type?.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setThumbnailUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isPdf])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPreviewClick(index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreviewClick(index)
        }
      }}
      className="group relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xs transition-all hover:border-clinical-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-clinical-500"
      title={`Click to preview: ${file.name} (${formatBytes(file.size)})`}
    >
      {/* Edge-to-edge Preview Content */}
      {isPdf ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/70 p-1 text-center transition-transform group-hover:scale-105">
          <svg className="h-7 w-7 text-red-500 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="mt-1 text-[10px] font-bold tracking-wider text-red-600">PDF</span>
        </div>
      ) : thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={file.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-400">
          IMG
        </div>
      )}

      {/* Hover Inspect Overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/25 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
      </div>

      {/* Cross (✕) Remove Button (Top-Right) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(index)
        }}
        aria-label={`Remove document #${index + 1}`}
        title="Remove document"
        className="absolute top-1.5 right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900/70 text-white shadow-xs backdrop-blur-xs transition-all hover:scale-110 hover:bg-red-600 active:scale-95"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Subtle Sequence Number (Bottom-Right, no pill) */}
      <span className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[11px] font-semibold text-slate-700/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] select-none">
        {index + 1}
      </span>
    </div>
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

  // Drag and drop state
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef(null)

  // Lightbox preview index (null when modal is closed)
  const [activePreviewIndex, setActivePreviewIndex] = useState(null)

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
        if (!cancelled) setPatients(list)
      } catch (err) {
        if (!cancelled) {
          setPatients([])
          setPatientsError(err instanceof Error ? err.message : 'Failed to load patients')
        }
      } finally {
        if (!cancelled) setPatientsLoading(false)
      }
    }

    loadPatients()

    return () => {
      cancelled = true
    }
  }, [])

  const handleAddFiles = useCallback(
    async (newFiles) => {
      if (!newFiles?.length) return
      setError(null)

      if (files.length >= MAX_FILES) {
        setError(
          `Maximum document limit reached (${MAX_FILES} files). Please remove some documents to add new ones.`,
        )
        return
      }

      if (files.length + newFiles.length > MAX_FILES) {
        const slotsLeft = MAX_FILES - files.length
        setError(
          `Cannot add ${newFiles.length} file${newFiles.length === 1 ? '' : 's'}. Maximum limit is ${MAX_FILES} documents (${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} remaining).`,
        )
        return
      }

      setOptimizing(true)

      try {
        const processedFiles = await Promise.all(
          newFiles.map((file) => compressImage(file)),
        )

        setFiles((prev) => {
          if (prev.length + processedFiles.length > MAX_FILES) {
            const slotsLeft = Math.max(0, MAX_FILES - prev.length)
            setError(
              `Maximum limit of ${MAX_FILES} documents exceeded. Only ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} remaining.`,
            )
            return prev
          }

          const combined = [...prev, ...processedFiles]
          const totalBytes = combined.reduce((sum, f) => sum + (f.size || 0), 0)
          const maxBytes = MAX_TOTAL_SIZE_MB * 1024 * 1024

          if (totalBytes > maxBytes) {
            setError(
              `Total file size (${formatBytes(totalBytes)}) exceeds the ${MAX_TOTAL_SIZE_MB} MB limit.`,
            )
            return prev
          }
          return combined
        })
      } catch (err) {
        console.error('File optimization error:', err)
        setFiles((prev) => {
          if (prev.length + newFiles.length > MAX_FILES) {
            const slotsLeft = Math.max(0, MAX_FILES - prev.length)
            setError(
              `Maximum limit of ${MAX_FILES} documents exceeded. Only ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} remaining.`,
            )
            return prev
          }
          return [...prev, ...newFiles]
        })
      } finally {
        setOptimizing(false)
      }
    },
    [files.length],
  )

  const handleRemoveFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }, [])

  const handleClearAll = useCallback(() => {
    setFiles([])
    setError(null)
  }, [])

  const onDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragActive(false)
    }
  }, [])

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragActive(false)
      if (files.length >= MAX_FILES) {
        setError(
          `Maximum document limit reached (${MAX_FILES} files). Please remove some documents to add new ones.`,
        )
        return
      }
      if (e.dataTransfer?.files?.length) {
        handleAddFiles(Array.from(e.dataTransfer.files))
      }
    },
    [files.length, handleAddFiles],
  )

  const handleGenerate = async () => {
    if (!files.length) return
    if (!USER_ID) {
      setError('Missing user ID. Set VITE_PLACEHOLDER_USER_ID in your .env file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await extractToDocx({ files })
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

  const totalBytes = useMemo(
    () => files.reduce((sum, f) => sum + (f.size || 0), 0),
    [files],
  )

  return (
    <div className="min-h-svh bg-slate-50">
      {/* Lightbox Modal */}
      {activePreviewIndex !== null && files[activePreviewIndex] && (
        <DocumentLightboxModal
          file={files[activePreviewIndex]}
          index={activePreviewIndex}
          total={files.length}
          onClose={() => setActivePreviewIndex(null)}
          onRemove={handleRemoveFile}
          onNext={
            activePreviewIndex < files.length - 1
              ? () => setActivePreviewIndex((i) => i + 1)
              : null
          }
          onPrev={
            activePreviewIndex > 0
              ? () => setActivePreviewIndex((i) => i - 1)
              : null
          }
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        disabled={loading || optimizing || files.length >= MAX_FILES}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleAddFiles(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />

      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Discharge Summary
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Upload clinical notes, labs, and documents to create a summary
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <section className="space-y-4">
          {/* Main Upload / Document Staging Area */}
          {!loading && (
            <div
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative rounded-2xl border-2 transition-all duration-150 ${
                isDragActive
                  ? 'border-clinical-500 bg-clinical-50/50 shadow-md ring-4 ring-clinical-500/10'
                  : 'border-slate-200 bg-white shadow-2xs hover:border-slate-300'
              }`}
            >
              {/* Dragging Overlay */}
              {isDragActive && (
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-clinical-50/90 backdrop-blur-xs">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-100 text-clinical-600 shadow-sm animate-bounce">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-clinical-800">
                    Drop documents to append in sequence
                  </p>
                </div>
              )}

              {files.length === 0 ? (
                /* Empty Dropzone State */
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center p-8 text-center sm:p-12"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-50 text-clinical-600 shadow-2xs transition-transform group-hover:scale-105">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-slate-800">
                    {optimizing ? 'Optimizing documents…' : 'Drag & drop patient records here'}
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 sm:text-sm">
                    Upload handwritten notes, clinical charts, labs, or hospital discharge papers
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">PDF</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">JPG</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">PNG</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">TIFF</span>
                    <span>· Up to {MAX_FILES} files ({MAX_TOTAL_SIZE_MB} MB)</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    disabled={optimizing}
                    className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-clinical-700 active:scale-98"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Browse Files</span>
                  </button>
                </div>
              ) : (
                /* Staged Files Grid (Claude / ChatGPT style) */
                <div className="p-4 sm:p-5">
                  {/* Top Bar with count and capacity */}
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400">
                        ({formatBytes(totalBytes)} of {MAX_TOTAL_SIZE_MB} MB)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={optimizing}
                        className="cursor-pointer text-xs font-medium text-slate-400 transition-colors hover:text-red-600"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* 1-Inch Square Thumbnails Grid */}
                  <div className="flex flex-wrap gap-2.5 sm:gap-3.5">
                    {files.map((file, index) => (
                      <DocumentSquareTile
                        key={`${file.name}-${index}`}
                        file={file}
                        index={index}
                        onRemove={handleRemoveFile}
                        onPreviewClick={(idx) => setActivePreviewIndex(idx)}
                      />
                    ))}

                    {/* Integrated "+ Add Page" Tile */}
                    {files.length < MAX_FILES ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={optimizing}
                        className="group flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-500 transition-all hover:border-clinical-500 hover:bg-clinical-50/50 hover:text-clinical-700 active:scale-95"
                        title="Add more pages"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors group-hover:border-clinical-300 group-hover:text-clinical-600 shadow-2xs">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <span className="mt-1.5 text-[11px] font-semibold">
                          {optimizing ? 'Optimizing…' : 'Add Page'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setError(`Maximum document limit reached (${MAX_FILES} files). Please remove some documents to add new ones.`)
                        }}
                        className="group flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50/40 text-amber-700 p-2 text-center transition-all hover:bg-amber-50 active:scale-95"
                        title={`Limit reached (${MAX_FILES} files)`}
                      >
                        <span className="text-xs font-bold text-amber-600">Max Limit</span>
                        <span className="mt-0.5 text-[10px] text-amber-700 font-medium">{MAX_FILES} / {MAX_FILES}</span>
                        <span className="mt-1 text-[9px] text-amber-600/80">Full</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom Helper Bar */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                    <p className="flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Click any page to preview. Read in order (#1 → #{files.length}).</span>
                    </p>
                    <span className="font-mono text-slate-400">
                      {MAX_FILES - files.length} slots left
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading Extraction Panel */}
          {loading && (
            <LoadingPanel
              title="Creating your discharge…"
              message="This can take upto 10 minutes. Please keep this tab open."
            />
          )}

          {/* Error Alert */}
          <ErrorAlert message={error} onDismiss={() => setError(null)} />

          {/* Generate Action Button */}
          {!loading && files.length > 0 && (
            <div className="flex justify-end pt-1">
          

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!files.length || loading || optimizing}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-clinical-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-98"
              >
                <svg className="h-4 w-4 text-clinical-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>
                  {optimizing
                    ? 'Optimizing documents…'
                    : `Generate Discharge`}
                </span>
              </button>
            </div>
          )}

          {/* Past Patients List */}
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
