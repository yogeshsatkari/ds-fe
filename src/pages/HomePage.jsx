import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FILE_ACCEPT,
  MAX_FILES,
  MAX_TOTAL_SIZE_MB,
  TEMPLATE_FILE_ACCEPT,
  USER_ID,
} from '../config.js'
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

  // Template state: 'custom' by default (template required), or 'standard'
  const [templateMode, setTemplateMode] = useState('custom')
  const [templateFiles, setTemplateFiles] = useState([])
  const [isTemplateDragActive, setIsTemplateDragActive] = useState(false)
  const templateInputRef = useRef(null)

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

  const onTemplateDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsTemplateDragActive(true)
  }, [])

  const onTemplateDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsTemplateDragActive(true)
  }, [])

  const onTemplateDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsTemplateDragActive(false)
    }
  }, [])

  const getTemplateCategory = useCallback((file) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (
      ext === '.docx' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'docx'
    }
    if (ext === '.pdf' || file.type === 'application/pdf') {
      return 'pdf'
    }
    if (
      ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ||
      file.type?.startsWith('image/')
    ) {
      return 'image'
    }
    if (ext === '.doc') {
      return 'doc_legacy'
    }
    return 'unsupported'
  }, [])

  const handleOpenTemplatePicker = useCallback((e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation()
    }
    if (templateInputRef.current) {
      templateInputRef.current.value = ''
      templateInputRef.current.click()
    }
  }, [])

  const handleAddTemplateFiles = useCallback(
    (incomingFiles) => {
      if (!incomingFiles || incomingFiles.length === 0) return
      setError(null)

      const categorized = incomingFiles.map((f) => ({
        file: f,
        cat: getTemplateCategory(f),
      }))

      // Check for legacy doc
      if (categorized.some((c) => c.cat === 'doc_legacy')) {
        setError(
          'Legacy Word format (.doc) is not supported. Please save your template as Word (.docx) or PDF (.pdf) and upload again.',
        )
        if (templateInputRef.current) templateInputRef.current.value = ''
        return
      }

      // Check for unsupported files
      const unsupported = categorized.filter((c) => c.cat === 'unsupported')
      if (unsupported.length > 0) {
        const names = unsupported.map((c) => c.file.name).join(', ')
        setError(
          `Unsupported template format for: ${names}. Allowed formats: Word (.docx), PDF (.pdf), or Image files (.jpg, .png, .webp).`,
        )
        if (templateInputRef.current) templateInputRef.current.value = ''
        return
      }

      // Check file size limits
      for (const item of categorized) {
        if (item.file.size > 30 * 1024 * 1024) {
          setError(`Template file "${item.file.name}" exceeds the 30 MB limit.`)
          if (templateInputRef.current) templateInputRef.current.value = ''
          return
        }
      }

      // Check categories in the incoming batch
      const incomingCategories = Array.from(new Set(categorized.map((c) => c.cat)))

      // Cannot mix different categories in the same upload
      if (incomingCategories.length > 1) {
        setError(
          'Incompatible template files. Please upload either a single Word document (.docx), a single PDF (.pdf), or image scans (.jpg, .png) — they cannot be mixed.',
        )
        if (templateInputRef.current) templateInputRef.current.value = ''
        return
      }

      const category = incomingCategories[0]

      if (category === 'docx') {
        if (incomingFiles.length > 1) {
          setError('Only a single Word template (.docx) is supported. Please upload one document.')
          if (templateInputRef.current) templateInputRef.current.value = ''
          return
        }
        // Exactly one docx file: replace current template
        setTemplateFiles([categorized[0].file])
      } else if (category === 'pdf') {
        if (incomingFiles.length > 1) {
          setError('Only a single PDF template (.pdf) is supported. Please upload one document.')
          if (templateInputRef.current) templateInputRef.current.value = ''
          return
        }
        // Exactly one pdf file: replace current template
        setTemplateFiles([categorized[0].file])
      } else if (category === 'image') {
        // All incoming are images
        setTemplateFiles((prev) => {
          // If previous template was a docx or pdf, replace it with the images
          const prevCats = new Set(prev.map((f) => getTemplateCategory(f)))
          if (prevCats.has('docx') || prevCats.has('pdf')) {
            return incomingFiles
          }
          // If previous was already images, append new ones without duplicates
          const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`))
          const fresh = incomingFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}`))
          return [...prev, ...fresh]
        })
      }

      if (templateInputRef.current) {
        templateInputRef.current.value = ''
      }
    },
    [getTemplateCategory],
  )

  const handleRemoveTemplateFile = useCallback((index) => {
    setTemplateFiles((prev) => prev.filter((_, idx) => idx !== index))
    if (templateInputRef.current) {
      templateInputRef.current.value = ''
    }
    setError(null)
  }, [])

  const handleClearTemplateFiles = useCallback(() => {
    setTemplateFiles([])
    if (templateInputRef.current) {
      templateInputRef.current.value = ''
    }
    setError(null)
  }, [])

  const onTemplateDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setIsTemplateDragActive(false)
      if (e.dataTransfer?.files?.length) {
        handleAddTemplateFiles(Array.from(e.dataTransfer.files))
      }
    },
    [handleAddTemplateFiles],
  )

  const isCustomMissingTemplate = templateMode === 'custom' && templateFiles.length === 0
  const canGenerate = files.length > 0 && !loading && !optimizing && !isCustomMissingTemplate

  const handleGenerate = async () => {
    if (!files.length) return
    if (isCustomMissingTemplate) {
      setError(
        'A custom template file (.docx, .pdf, or image) is required when Custom Template mode is selected. Please attach a template file or switch to Standard format.',
      )
      return
    }
    if (!USER_ID) {
      setError('Missing user ID. Set VITE_PLACEHOLDER_USER_ID in your .env file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await extractToDocx({
        files,
        templateFiles: templateMode === 'custom' ? templateFiles : [],
        dischargeType: templateMode,
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
        onClick={(e) => {
          e.target.value = ''
        }}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleAddFiles(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />

      {/* Hidden File Input for Custom Template */}
      <input
        ref={templateInputRef}
        type="file"
        accept={TEMPLATE_FILE_ACCEPT}
        multiple
        disabled={loading || optimizing}
        className="hidden"
        onClick={(e) => {
          e.target.value = ''
        }}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleAddTemplateFiles(Array.from(e.target.files))
            e.target.value = ''
          }
        }}
      />

      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Discharge Summary
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Upload clinical notes and choose your discharge format
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="space-y-6">
          {/* Side-by-Side: Patient Records & Discharge Template */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* 1. Patient Clinical Records Box */}
              <div
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative flex flex-col justify-between rounded-2xl border-2 transition-all duration-150 min-h-[420px] lg:col-span-7 ${isDragActive
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

                {/* Box Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-clinical-100 text-xs font-bold text-clinical-700">
                      1
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 leading-none">
                        Patient Records
                      </h3>
                      <span className="text-[11px] text-slate-400">Notes, charts, labs & records</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {files.length} / {MAX_FILES} files
                  </span>
                </div>

                {/* Box Body */}
                <div className="flex-1 flex flex-col justify-center">
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
                      className="flex cursor-pointer flex-col items-center justify-center p-8 text-center sm:p-10 flex-1"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-50 text-clinical-600 shadow-2xs transition-transform hover:scale-105">
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>

                      <h4 className="mt-4 text-base font-semibold text-slate-800">
                        {optimizing ? 'Optimizing documents…' : 'Drag & drop patient records here'}
                      </h4>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        Upload notes, charts, labs, or hospital papers to summarize
                      </p>

                      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">PDF</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">JPG</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">PNG</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">TIFF</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                        disabled={optimizing}
                        className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-clinical-700 active:scale-98"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Browse Files</span>
                      </button>
                    </div>
                  ) : (
                    /* Staged Files Grid */
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="mb-3 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2.5">
                          <span className="font-medium text-slate-700">
                            {files.length} page{files.length === 1 ? '' : 's'} in sequence
                          </span>
                          <div className="flex items-center gap-2 sm:gap-2.5 font-mono text-[11px] sm:text-xs text-slate-400">
                            <span>{formatBytes(totalBytes)} of {MAX_TOTAL_SIZE_MB} MB</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5 max-h-72 overflow-y-auto pr-1">
                          {files.map((file, index) => (
                            <DocumentSquareTile
                              key={`${file.name}-${index}`}
                              file={file}
                              index={index}
                              onRemove={handleRemoveFile}
                              onPreviewClick={(idx) => setActivePreviewIndex(idx)}
                            />
                          ))}

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
                          ) : null}
                        </div>
                      </div>

                      {/* Bottom Helper Bar */}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <span>💡</span>
                          <span>Click to preview</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          disabled={optimizing}
                          className="cursor-pointer text-xs text-slate-400 hover:text-red-600 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Discharge Template Box */}
              <div
                onDragEnter={templateMode === 'custom' ? onTemplateDragEnter : undefined}
                onDragOver={templateMode === 'custom' ? onTemplateDragOver : undefined}
                onDragLeave={templateMode === 'custom' ? onTemplateDragLeave : undefined}
                onDrop={templateMode === 'custom' ? onTemplateDrop : undefined}
                className={`relative flex flex-col justify-between rounded-2xl border-2 transition-all duration-150 min-h-[420px] lg:col-span-5 ${isTemplateDragActive
                  ? 'border-clinical-500 bg-clinical-50/50 shadow-md ring-4 ring-clinical-500/10'
                  : 'border-slate-200 bg-white shadow-2xs hover:border-slate-300'
                  }`}
              >
                {/* Dragging Overlay */}
                {isTemplateDragActive && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-clinical-50/90 backdrop-blur-xs">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clinical-100 text-clinical-600 shadow-sm animate-bounce">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-clinical-800">
                      Drop template document here
                    </p>
                  </div>
                )}

                {/* Box Header with Custom / Standard Switcher */}
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-clinical-100 text-xs font-bold text-clinical-700">
                      2
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 leading-none">
                        Discharge Template
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        {templateMode === 'custom' ? 'Custom format' : ' Preconfigured clinical discharge protocol'}
                      </span>
                    </div>
                  </div>

                  {/* Mode Switcher: Custom (Default) vs Standard */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateMode('custom')
                        setError(null)
                      }}
                      className={`cursor-pointer rounded-md px-3 py-1 font-medium transition-all ${templateMode === 'custom'
                        ? 'bg-white text-clinical-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Custom
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateMode('standard')
                        setError(null)
                      }}
                      className={`cursor-pointer rounded-md px-3 py-1 font-medium transition-all ${templateMode === 'standard'
                        ? 'bg-white text-clinical-700 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      Standard
                    </button>
                  </div>
                </div>

                {/* Box Body */}
                <div className="flex-1 flex flex-col justify-center">
                  {templateMode === 'custom' ? (
                    templateFiles.length === 0 ? (
                      /* Custom Mode: Empty Dropzone (Required) */
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={handleOpenTemplatePicker}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleOpenTemplatePicker(e)
                          }
                        }}
                        className="flex cursor-pointer flex-col items-center justify-center p-8 text-center sm:p-10 flex-1"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clinical-50 text-clinical-600 shadow-2xs transition-transform hover:scale-105">
                          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>

                        <h4 className="mt-4 text-base font-semibold text-slate-800">
                          Discharge Summary Template
                        </h4>
                        <p className="mt-1 max-w-xs text-xs text-slate-500">
                          Upload your hospital's template or sample summary
                        </p>

                        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">DOCX</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">PDF</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">Images</span>
                        </div>

                        <button
                          type="button"
                          onClick={handleOpenTemplatePicker}
                          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-clinical-700 active:scale-98"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Browse Template</span>
                        </button>
                      </div>
                    ) : (
                      /* Custom Mode: Staged Template Files */
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {templateFiles.map((tf, i) => (
                              <div
                                key={`${tf.name}-${i}`}
                                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-clinical-100 text-clinical-700 font-bold text-xs uppercase">
                                    {tf.name.split('.').pop() || 'DOC'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-800">
                                      {tf.name}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-500">
                                      {formatBytes(tf.size)}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveTemplateFile(i)}
                                  className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Remove template file"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Custom Template Bottom Controls */}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={handleOpenTemplatePicker}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-clinical-700 hover:text-clinical-800 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              {templateFiles[0] && ['docx', 'pdf'].includes(getTemplateCategory(templateFiles[0])) ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              )}
                            </svg>
                            <span>
                              {templateFiles[0] && ['docx', 'pdf'].includes(getTemplateCategory(templateFiles[0]))
                                ? 'Replace template'
                                : 'Add another page (image)'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={handleClearTemplateFiles}
                            className="cursor-pointer text-xs text-slate-400 hover:text-red-600 transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    /* Standard Mode: Information & Feature Checklist */
                    <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">
                            Standard Institutional Template
                          </h4>

                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3 text-xs text-slate-700">
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Generates standardized multi-section discharge summary with strict clinical grounding and built-in physician verification flags:
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-clinical-600 font-bold">✓</span>
                              <span>Patient Demographics & Admission Details</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-clinical-600 font-bold">✓</span>
                              <span>Structured ABCDE On-Admission Vitals & Exam</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-clinical-600 font-bold">✓</span>
                              <span>Inpatient Hospital Course & Timeline</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-clinical-600 font-bold">✓</span>
                              <span>Key Laboratory Panels & Treatment Given</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-clinical-600 font-bold">✓</span>
                              <span>Discharge Medications, Follow-up & Red Flags</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateMode('custom')
                            setError(null)
                          }}
                          className="cursor-pointer text-clinical-700 hover:text-clinical-800 font-medium"
                        >
                          Use Custom Template →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading Extraction Panel */}
          {loading && (
            <LoadingPanel
              title="Creating your discharge…"
              message="This can take upto 3 minutes. Please keep this tab open."
            />
          )}

          {/* Error Alert */}
          <ErrorAlert message={error} onDismiss={() => setError(null)} />

          {/* Action & Generate Bar */}
          {!loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-800">
                  {files.length === 0
                    ? '0 patient documents'
                    : `${files.length} document${files.length === 1 ? '' : 's'} ready`}
                </span>
                {templateMode === 'custom' ? (
                  templateFiles.length > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-clinical-700 bg-clinical-50 border border-clinical-200 px-2.5 py-1 rounded-lg">
                        <span className="h-1.5 w-1.5 rounded-full bg-clinical-600"></span>
                        <span>Custom template ({templateFiles.length} file{templateFiles.length === 1 ? '' : 's'})</span>
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-clinical-700 bg-clinical-50 border border-clinical-200 px-2.5 py-1 rounded-lg">
                      <span className="h-1.5 w-1.5 rounded-full bg-clinical-600"></span>
                      <span>Standard institutional template</span>
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="inline-flex w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-xl bg-clinical-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-clinical-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-98"
              >
                <svg className="h-4 w-4 text-clinical-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>
                  {optimizing ? 'Optimizing documents…' : 'Generate Discharge Summary'}
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
