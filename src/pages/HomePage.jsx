import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FILE_ACCEPT,
  MAX_FILES,
  MAX_TOTAL_SIZE_MB,
  clearDoctorAuth,
  getStoredUserId,
} from '../config.js'
import {
  editSummaryPath,
  extractToDocx,
  fetchUserPatients,
  fetchUserTemplate,
  saveUserTemplateToCloud,
  getActiveTemplateSyncPromise,
} from '../api/dischargeApi.js'
import { useSession } from '../hooks/useSession.js'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import PastPatientsList from '../components/PastPatientsList.jsx'
import DoctorAuthCard from '../components/DoctorAuthCard.jsx'
import AccountMenu from '../components/AccountMenu.jsx'
import TemplateManagerModal from '../components/TemplateManagerModal.jsx'
import { compressImage } from '../utils/compressImage.js'
import { getDoctorTemplate, markTemplateCloudSynced } from '../utils/templateStorage.js'

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
        <div className="border-b border-slate-200 bg-white px-3.5 py-2.5 sm:px-5 sm:py-3 space-y-1.5">
          {/* Top Control Bar: Page Badge (Left) + Actions (Right) */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex h-5.5 sm:h-6 items-center rounded-full bg-clinical-50 border border-clinical-200 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold text-clinical-700">
              Page {index + 1} of {total}
            </span>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  onRemove(index)
                  onClose()
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-red-50/80 px-2 sm:px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:border-red-300 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Remove</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close preview"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Heading: Filename & Details */}
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <h2 className="truncate text-xs sm:text-sm font-semibold text-slate-900 min-w-0" title={file.name}>
              {file.name}
            </h2>
            <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0 font-normal">
              {formatBytes(file.size)} · {isPdf ? 'PDF' : 'Image'}
            </span>
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

      {/* Sequence Number */}
      <span className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[11px] font-semibold text-slate-700/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] select-none">
        {index + 1}
      </span>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { update } = useSession()

  // Reads directly from localStorage on load (0ms latency)
  const [userId, setUserId] = useState(getStoredUserId)

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [error, setError] = useState(null)
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(Boolean(getStoredUserId()))
  const [patientsError, setPatientsError] = useState(null)

  // Drag and drop state for patient files
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef(null)

  // Doctor template state (defaults to standard protocol)
  const [doctorTemplate, setDoctorTemplate] = useState({
    mode: 'standard',
    files: [],
    filename: '',
  })
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  // Lightbox preview index (null when modal is closed)
  const [activePreviewIndex, setActivePreviewIndex] = useState(null)

  // Load saved template from IndexedDB (or fallback to Cloud R2)
  useEffect(() => {
    if (userId) {
      getDoctorTemplate(userId).then(async (tpl) => {
        if (tpl && (tpl.mode === 'custom' || tpl.files?.length > 0)) {
          setDoctorTemplate(tpl)
          // Self-healing: if custom template is saved locally but cloud sync wasn't completed
          // (e.g. user closed browser or navigated away right after choosing it), silently upload now!
          if (!tpl.cloudSynced && tpl.files?.length > 0) {
            saveUserTemplateToCloud(userId, tpl.files)
              .then(() => {
                markTemplateCloudSynced(userId)
                setDoctorTemplate((prev) => ({ ...prev, cloudSynced: true, syncing: false }))
              })
              .catch((err) => {
                console.warn('Silent cloud template self-heal failed:', err)
              })
          }
        } else {
          // If local has no custom template, check if cloud has one
          try {
            const cloudMeta = await fetchUserTemplate(userId)
            if (cloudMeta && cloudMeta.mode === 'custom') {
              setDoctorTemplate({
                mode: 'custom',
                files: [],
                filename: cloudMeta.filename || 'Custom Hospital Template',
                fileCount: cloudMeta.file_count || 1,
                cloudSynced: true,
                syncing: false,
              })
            } else if (tpl) {
              setDoctorTemplate(tpl)
            }
          } catch {
            if (tpl) setDoctorTemplate(tpl)
          }
        }
      })
    }
  }, [userId])

  const fetchPreviousDischarges = useCallback(async (activeUserId) => {
    if (!activeUserId) {
      setPatients([])
      setPatientsLoading(false)
      return
    }

    setPatientsLoading(true)
    setPatientsError(null)
    try {
      const list = await fetchUserPatients(activeUserId)
      setPatients(list)
    } catch (err) {
      setPatients([])
      setPatientsError(err instanceof Error ? err.message : 'Failed to load patients')
    } finally {
      setPatientsLoading(false)
    }
  }, [])

  // Whenever userId changes or loads, fetch their previous discharges
  useEffect(() => {
    if (userId) {
      fetchPreviousDischarges(userId)
    } else {
      setPatients([])
      setPatientsLoading(false)
    }
  }, [userId, fetchPreviousDischarges])

  const handleSwitchAccount = () => {
    clearDoctorAuth()
    setUserId(null)
    setPatients([])
    setDoctorTemplate({ mode: 'standard', files: [], filename: '' })
  }

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
    if (doctorTemplate.isOneOff && userId) {
      getDoctorTemplate(userId).then((defaultTpl) => {
        if (defaultTpl) setDoctorTemplate(defaultTpl)
      })
    }
  }, [doctorTemplate.isOneOff, userId])

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

  // Ready to generate whenever documents are attached
  const canGenerate = files.length > 0 && !loading && !optimizing

  const handleGenerate = async () => {
    if (!files.length) return
    if (!userId) {
      setError('Please set up or log into your doctor profile first.')
      return
    }

    setLoading(true)
    setError(null)

    const isOneOff = Boolean(doctorTemplate.isOneOff && doctorTemplate.files?.length > 0)
    let isCloudSynced = Boolean(doctorTemplate.cloudSynced)

    // Deduplication & Cost Prevention:
    // If a cloud template sync is currently in-flight in the background, await it!
    // Since the doctor clicked Generate, they are on the generation loading screen anyway.
    // By awaiting the already-running sync (which is already seconds into processing):
    // 1. We NEVER call Gemini twice on the same template (zero duplicate AI cost).
    // 2. The extraction uses the pre-parsed template from R2 directly.
    const activeSync = getActiveTemplateSyncPromise()
    if (activeSync && !isCloudSynced && !isOneOff) {
      try {
        await Promise.race([
          activeSync,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 12000)),
        ])
        isCloudSynced = true
      } catch (syncErr) {
        console.warn('In-flight template sync failed or timed out, falling back to direct upload:', syncErr)
      }
    }

    const isCustom = Boolean(doctorTemplate.mode === 'custom' || isOneOff)
    const shouldSendFiles = Boolean(
      doctorTemplate.files?.length > 0 &&
      (isOneOff || !isCloudSynced)
    )
    const templateFilesToSend = shouldSendFiles ? doctorTemplate.files : []
    const dischargeTypeToSend = isCustom ? 'custom' : 'standard'

    try {
      const data = await extractToDocx({
        userId,
        files,
        templateFiles: templateFilesToSend,
        dischargeType: dischargeTypeToSend,
      })
      if (doctorTemplate.isOneOff && userId) {
        getDoctorTemplate(userId).then((defaultTpl) => {
          if (defaultTpl) setDoctorTemplate(defaultTpl)
        })
      }
      update({
        patientId: data.patientId,
        filename: data.filename,
      })
      navigate(editSummaryPath(userId, data.patientId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setLoading(false)
    }
  }

  const handleOpenPatient = (patient) => {
    if (!userId || !patient?.patient_id) return
    update({ patientId: patient.patient_id })
    navigate(editSummaryPath(userId, patient.patient_id))
  }

  const totalBytes = useMemo(
    () => files.reduce((sum, f) => sum + (f.size || 0), 0),
    [files],
  )

  if (!userId) {
    return <DoctorAuthCard onAuthSuccess={(id) => setUserId(id)} />
  }

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

      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        userId={userId}
        currentTemplate={doctorTemplate}
        onTemplateSaved={(savedTpl) => {
          setDoctorTemplate(savedTpl)
        }}
      />

      {/* Hidden File Input for Patient Records */}
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

      {/* Main Header with Account Menu */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-5xl items-center justify-between px-3.5 sm:px-6">
          {/* Brand Emblem & App Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="flex h-8.5 w-8.5 sm:h-9.5 sm:w-9.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 text-white shadow-xs ring-1 ring-teal-500/25">
              <svg className="h-4.5 w-4.5 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none">
                {/* Rounded Swiss Medical Cross */}
                <path
                  d="M10.5 4.5a1.5 1.5 0 0 0-3 0v4H3.5a1.5 1.5 0 0 0 0 3h4v4a1.5 1.5 0 0 0 3 0v-4h4a1.5 1.5 0 0 0 0-3h-4v-4z"
                  fill="currentColor"
                />
                {/* 4-Point AI Sparkle */}
                <path
                  d="M18.5 2.5c0 2.2 1.6 3.8 3.8 3.8-2.2 0-3.8 1.6-3.8 3.8 0-2.2-1.6-3.8-3.8-3.8 2.2 0 3.8-1.6 3.8-3.8z"
                  fill="currentColor"
                  className="text-emerald-200"
                />
                {/* Micro Accent Spark */}
                <circle cx="20" cy="14" r="1" fill="currentColor" opacity="0.85" className="text-cyan-100" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 leading-none whitespace-nowrap">
                  Discharge <span className="text-teal-600 font-extrabold">Summary</span>
                </h1>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 truncate mt-1">
                Upload clinical notes to create a verified discharge summary
              </p>
            </div>
          </div>

          {/* Account Profile Menu */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <AccountMenu
              userId={userId}
              currentTemplate={doctorTemplate}
              onOpenTemplateManager={() => setIsTemplateModalOpen(true)}
              onLogout={handleSwitchAccount}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <section className="space-y-4">
          {/* Patient Clinical Records Box (Full Width, Zero Clutter) */}
          {!loading && (
            <div
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative flex flex-col justify-between rounded-2xl border-2 transition-all duration-150 min-h-[360px] w-full ${isDragActive
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
                    Drop patient documents to append in sequence
                  </p>
                </div>
              )}

              {/* Box Header (Responsive, avoids truncation on mobile) */}
              <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5 sm:px-5 sm:py-3.5">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-bold text-teal-700 border border-teal-200/60 shadow-2xs">
                    1
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-none truncate">
                      <span className="sm:hidden">Patient Records</span>
                      <span className="hidden sm:inline">Patient Clinical Records</span>
                    </h3>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 truncate block mt-0.5">
                      <span className="sm:hidden">Notes, charts & reports</span>
                      <span className="hidden sm:inline">Notes, charts, labs & clinical documents</span>
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 border border-slate-200/60 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold text-slate-600 shrink-0 ml-2">
                  {files.length} / {MAX_FILES}
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
                    className="flex cursor-pointer flex-col items-center justify-center p-8 text-center sm:p-12 flex-1"
                  >
                    <div className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50/70 border border-teal-100/80 text-teal-600 shadow-2xs transition-transform hover:scale-105">
                      <svg className="h-6 w-6 sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>

                    <h4 className="mt-3.5 text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      {optimizing ? 'Optimizing documents…' : 'Drop patient records here'}
                    </h4>
                    <p className="mt-1 max-w-xs text-xs text-slate-500 leading-relaxed font-normal">
                      Case sheets, doctor notes, labs or discharge reports
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <span className="rounded-md bg-slate-100/90 border border-slate-200/60 px-2 py-0.5">JPG</span>
                      <span className="rounded-md bg-slate-100/90 border border-slate-200/60 px-2 py-0.5">PNG</span>
                      <span className="rounded-md bg-slate-100/90 border border-slate-200/60 px-2 py-0.5">PDF</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={optimizing}
                      className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-semibold text-white shadow-sm shadow-teal-700/20 transition-all active:scale-98 whitespace-nowrap"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Upload Documents</span>
                    </button>
                  </div>
                ) : (
                  /* Staged Files Grid */
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="mb-3 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2.5">
                        <span className="font-medium text-slate-700">
                          {files.length} document{files.length === 1 ? '' : 's'} in sequence
                        </span>
                        <div className="flex items-center gap-2 sm:gap-2.5 font-mono text-[11px] sm:text-xs text-slate-400">
                          <span>{formatBytes(totalBytes)} of {MAX_TOTAL_SIZE_MB} MB</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5 max-h-80 overflow-y-auto pr-1">
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
                        <span>Tap any thumbnail to preview full page</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={optimizing}
                        className="cursor-pointer text-xs text-slate-400 hover:text-red-600 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading Extraction Panel */}
          {loading && (
            <LoadingPanel
              title="Creating your discharge…"
              message="This can take up to 2 minutes. Please keep this tab open."
            />
          )}

          {/* Error Alert */}
          <ErrorAlert message={error} onDismiss={() => setError(null)} />

          {/* Action & Generate Bar */}
          {!loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
              <div className="w-full sm:w-auto">
                {doctorTemplate.mode === 'custom' && (doctorTemplate.filename || doctorTemplate.files?.length > 0) ? (
                  <div className="flex items-center justify-between gap-2.5 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs w-full sm:w-auto">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-700 text-xs font-bold">
                        📄
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-500 font-medium text-xs shrink-0">
                          Sample:
                        </span>
                        <span
                          className="font-semibold text-slate-800 truncate max-w-[170px] sm:max-w-[260px]"
                          title={doctorTemplate.filename}
                        >
                          {doctorTemplate.filename || 'Sample Discharge'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer shrink-0 transition-colors ml-1"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start w-full">
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-teal-700 underline cursor-pointer transition-colors py-1 text-center"
                    >
                      <span>＋ Add sample discharge (optional)</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`inline-flex w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-3 text-sm font-semibold transition-all active:scale-98 whitespace-nowrap ${
                  canGenerate
                    ? 'bg-gradient-to-r from-teal-600 via-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-sm shadow-teal-700/25 hover:shadow-md'
                    : 'bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed shadow-none'
                }`}
              >
                <svg
                  className={`h-4.5 w-4.5 shrink-0 ${canGenerate ? 'text-teal-200 animate-pulse' : 'text-slate-400'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                <span>
                  {optimizing ? 'Optimizing documents…' : 'Create Discharge Summary'}
                </span>
              </button>
            </div>
          )}

          {/* Past Patients List */}
          {!loading && userId && (
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
