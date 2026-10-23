import { useCallback, useRef, useState, useEffect } from 'react'
import { TEMPLATE_FILE_ACCEPT } from '../config.js'
import {
  saveDoctorTemplate,
  clearDoctorTemplate,
  markTemplateCloudSynced,
} from '../utils/templateStorage.js'
import {
  saveUserTemplateToCloud,
  deleteUserTemplateFromCloud,
  downloadDoctorTemplateFile,
} from '../api/dischargeApi.js'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TemplateManagerModal({
  isOpen,
  onClose,
  userId,
  currentTemplate = { mode: 'standard', files: [], filename: '', isOneOff: false },
  onTemplateSaved,
}) {
  const [stagedFiles, setStagedFiles] = useState(currentTemplate.files || [])
  const [applyScope, setApplyScope] = useState(currentTemplate.isOneOff ? 'one_off' : 'default')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const fileInputRef = useRef(null)
  const isAddingMoreRef = useRef(false)

  const isCustomActive =
    currentTemplate.mode === 'custom' &&
    (currentTemplate.filename || currentTemplate.files?.length > 0)

  useEffect(() => {
    if (isOpen) {
      setStagedFiles(currentTemplate.files || [])
      setApplyScope(currentTemplate.isOneOff ? 'one_off' : 'default')
      setError(null)
      isAddingMoreRef.current = false
    }
  }, [isOpen, currentTemplate])

  const getCategory = useCallback((file) => {
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
    return 'unsupported'
  }, [])

  const handleTriggerReplace = () => {
    isAddingMoreRef.current = false
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleTriggerAddMore = () => {
    isAddingMoreRef.current = true
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFilesChosen = (incomingList) => {
    if (!incomingList || !incomingList.length) return
    setError(null)

    const list = Array.from(incomingList)

    for (const f of list) {
      const cat = getCategory(f)
      if (cat === 'unsupported') {
        setError(`"${f.name}" is not supported. Use Word (.docx), PDF (.pdf), or image scans.`)
        return
      }
      if (f.size > 30 * 1024 * 1024) {
        setError(`"${f.name}" exceeds the 30 MB size limit.`)
        return
      }
    }

    const hasDocument = list.some((f) => getCategory(f) === 'docx' || getCategory(f) === 'pdf')

    // Rule 1: If incoming file(s) contain a Word (.docx) or PDF (.pdf) document:
    // Seamlessly replace any existing staged images or files with this document.
    if (hasDocument) {
      isAddingMoreRef.current = false
      const docFile = list.find((f) => getCategory(f) === 'docx' || getCategory(f) === 'pdf')
      setStagedFiles([docFile])
      return
    }

    // Rule 2: If incoming file(s) are all images:
    if (isAddingMoreRef.current) {
      // User explicitly clicked "+ Add page" to append more pages to an image scan
      setStagedFiles((prev) => {
        const prevImages = prev.filter((f) => getCategory(f) === 'image')
        const existingKeys = new Set(prevImages.map((f) => `${f.name}-${f.size}`))
        const fresh = list.filter((f) => !existingKeys.has(`${f.name}-${f.size}`))
        return [...prevImages, ...fresh]
      })
    } else {
      // Fresh selection / Replace: Replace existing files with the new image(s)
      setStagedFiles(list)
    }
    isAddingMoreRef.current = false
  }

  const handleDownloadExisting = async () => {
    if (!userId) return
    setDownloading(true)
    setError(null)
    try {
      const { blob, filename } = await downloadDoctorTemplateFile(userId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || currentTemplate.filename || 'hospital-template'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download template file')
    } finally {
      setDownloading(false)
    }
  }

  const handleSave = async () => {
    if (stagedFiles.length === 0) {
      setError('Please attach a template file (.docx, .pdf, or scan).')
      return
    }

    setError(null)
    const filename = stagedFiles[0]?.name || 'custom-template'
    const filesToSave = [...stagedFiles]
    const isDefault = applyScope === 'default'

    // 1. Optimistic Local Save (Instant, <5ms)
    try {
      if (isDefault) {
        await saveDoctorTemplate(userId, {
          mode: 'custom',
          files: filesToSave,
          filename,
          cloudSynced: false,
        })
      }
    } catch (err) {
      console.warn('Local template save warning:', err)
    }

    // 2. Instantly notify parent and close modal without waiting!
    onTemplateSaved?.({
      mode: 'custom',
      files: filesToSave,
      filename,
      fileCount: filesToSave.length,
      isOneOff: !isDefault,
      cloudSynced: false,
      syncing: isDefault,
    })
    onClose()

    // 3. Background Cloud Sync (Runs asynchronously without blocking the user)
    if (isDefault && userId) {
      saveUserTemplateToCloud(userId, filesToSave)
        .then(() => {
          markTemplateCloudSynced(userId)
          onTemplateSaved?.({
            mode: 'custom',
            files: filesToSave,
            filename,
            fileCount: filesToSave.length,
            isOneOff: false,
            cloudSynced: true,
            syncing: false,
          })
        })
        .catch((cloudErr) => {
          console.warn('Background template cloud sync warning:', cloudErr)
          // File remains safe and active locally in IndexedDB
        })
    }
  }

  const handleRemove = async () => {
    // 1. Instantly clear locally and close modal without waiting
    try {
      await clearDoctorTemplate(userId)
    } catch (err) {
      console.warn('Clear local template error:', err)
    }

    onTemplateSaved?.({
      mode: 'standard',
      files: [],
      filename: '',
      fileCount: 0,
      isOneOff: false,
      syncing: false,
    })
    onClose()

    // 2. Background Cloud Delete
    if (userId) {
      deleteUserTemplateFromCloud(userId).catch((err) => {
        console.warn('Background cloud template deletion warning:', err)
      })
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (e.dataTransfer?.files?.length) {
            handleFilesChosen(e.dataTransfer.files)
          }
        }}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={TEMPLATE_FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFilesChosen(e.target.files)
              e.target.value = ''
            }
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 text-base sm:text-lg shadow-2xs">
              📄
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {isCustomActive ? 'Sample Discharge' : 'Add Sample Discharge'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {isCustomActive
                  ? 'Sample format used to format generated summaries'
                  : 'Upload a sample discharge (.docx, .pdf, or scans)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {stagedFiles.length === 0 ? (
            isCustomActive ? (
              /* Active Saved Profile Sample Card */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-xs uppercase">
                    {(currentTemplate.filename || '').split('.').pop() || 'DOC'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-semibold text-slate-900" title={currentTemplate.filename}>
                        {currentTemplate.filename || 'Sample Discharge'}
                      </p>
                      <span className="hidden sm:inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 shrink-0">
                        Active Default
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Applied automatically to format all discharges
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleDownloadExisting}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    title="Download active template file from cloud"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{downloading ? 'Downloading…' : 'Download'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTriggerReplace}
                    className="inline-flex items-center rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors cursor-pointer"
                  >
                    Replace
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State: Dropzone */
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 sm:p-7 text-center hover:border-teal-500 hover:bg-teal-50/30 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 mb-2 shadow-2xs">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Upload Sample Discharge
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  (.docx, .pdf or photos)
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Browse File</span>
                </button>
              </div>
            )
          ) : (
            /* Selected File Preview & Usage Options */
            <div className="space-y-3">
              {(() => {
                const isMultiImage =
                  stagedFiles.length > 1 && stagedFiles.every((f) => getCategory(f) === 'image')

                // Single file (whether document or single image)
                if (!isMultiImage) {
                  const file = stagedFiles[0]
                  const isImage = getCategory(file) === 'image'
                  const ext = (file?.name || '').split('.').pop()?.toUpperCase() || (isImage ? 'IMG' : 'DOC')

                  return (
                    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 sm:px-3.5 sm:py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-800 font-bold text-[10px] uppercase">
                          {ext}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[11px] text-slate-400">{formatBytes(file.size)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        {isImage ? (
                          <button
                            type="button"
                            onClick={handleTriggerAddMore}
                            className="text-xs font-medium text-teal-700 hover:text-teal-900 cursor-pointer transition-colors"
                          >
                            <span className="sm:hidden">+ Add page</span>
                            <span className="hidden sm:inline">+ Add page</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleTriggerReplace}
                            className="text-xs font-medium text-teal-700 hover:text-teal-900 underline cursor-pointer transition-colors"
                          >
                            Replace
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStagedFiles([])}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                }

                // Multi-page image scans (2 or more pages)
                return (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {/* Header Bar */}
                    <div className="flex items-center justify-between gap-2 bg-slate-50/80 px-3 py-2 sm:px-3.5 border-b border-slate-200/80 text-xs">
                      <span className="font-semibold text-slate-700 whitespace-nowrap text-xs">
                        <span className="sm:hidden">Scans ({stagedFiles.length}p)</span>
                        <span className="hidden sm:inline">Sample Scans ({stagedFiles.length} pages)</span>
                      </span>
                      <div className="flex items-center gap-2 text-xs shrink-0 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={handleTriggerAddMore}
                          className="font-medium text-teal-700 hover:text-teal-900 cursor-pointer transition-colors"
                        >
                          <span className="sm:hidden">+ Add page</span>
                          <span className="hidden sm:inline">+ Add page</span>
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => setStagedFiles([])}
                          className="font-medium text-slate-500 hover:text-red-600 cursor-pointer transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Slim Divider List */}
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {stagedFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between px-3.5 py-2 text-xs hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-5 items-center justify-center rounded bg-teal-50 px-1.5 text-[10px] font-bold text-teal-700 shrink-0">
                              P.{idx + 1}
                            </span>
                            <p className="truncate font-medium text-slate-800 min-w-0" title={file.name}>
                              {file.name}
                            </p>
                            <span className="text-[11px] text-slate-400 shrink-0 font-normal">
                              ({formatBytes(file.size)})
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setStagedFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0 ml-2"
                            title={`Remove page ${idx + 1}`}
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Scope Selection: One-off vs Default */}
              <div className="space-y-2 pt-0.5">
                <label className="block text-xs font-semibold text-slate-700">
                  How would you like to use this sample?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Just for this discharge */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setApplyScope('one_off')}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setApplyScope('one_off')}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      applyScope === 'one_off'
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Use for this Discharge only</span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          applyScope === 'one_off'
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {applyScope === 'one_off' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                      Apply just for now without saving for future
                    </p>
                  </div>

                  {/* Option 2: Save as default for future discharges */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setApplyScope('default')}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setApplyScope('default')}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      applyScope === 'default'
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Use and Save for Future</span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          applyScope === 'default'
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {applyScope === 'default' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                      Keep as default for all future patients
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
          {isCustomActive && (
            <button
              type="button"
              disabled={saving}
              onClick={handleRemove}
              className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer transition-colors"
            >
              Remove Sample
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {stagedFiles.length === 0 ? 'Close' : 'Cancel'}
            </button>

            {stagedFiles.length > 0 && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || stagedFiles.length === 0}
                className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Applying…' : 'Apply Sample'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
