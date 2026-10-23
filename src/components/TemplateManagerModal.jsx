import { useCallback, useRef, useState, useEffect } from 'react'
import { TEMPLATE_FILE_ACCEPT } from '../config.js'
import { saveDoctorTemplate, clearDoctorTemplate } from '../utils/templateStorage.js'
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

    const firstCat = getCategory(list[0])

    if (isAddingMoreRef.current) {
      // User tapped "+ Add More Pages" specifically
      const allAreImages = list.every((f) => getCategory(f) === 'image')
      if (!allAreImages) {
        setError('Only image files (.jpg, .png, .webp) can be added to an existing image template. To use Word or PDF, click Replace.')
        return
      }
      setStagedFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`))
        const fresh = list.filter((f) => !existingKeys.has(`${f.name}-${f.size}`))
        return [...prev, ...fresh]
      })
    } else {
      // Replace / Fresh Upload Mode
      if (firstCat === 'docx' || firstCat === 'pdf') {
        if (list.length > 1) {
          setError('Only a single Word (.docx) or PDF (.pdf) file can be used as a template.')
          return
        }
        setStagedFiles([list[0]])
      } else {
        // Fresh image batch
        setStagedFiles(list)
      }
    }
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

    setSaving(true)
    setError(null)
    try {
      const filename = stagedFiles[0]?.name || 'custom-template'

      // Only write to persistent storage if user chose "Save for Later"
      if (applyScope === 'default') {
        await saveDoctorTemplate(userId, {
          mode: 'custom',
          files: stagedFiles,
          filename,
        })
        await saveUserTemplateToCloud(userId, stagedFiles)
      }

      onTemplateSaved?.({
        mode: 'custom',
        files: stagedFiles,
        filename,
        fileCount: stagedFiles.length,
        isOneOff: applyScope === 'one_off',
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    setError(null)
    try {
      await clearDoctorTemplate(userId)
      await deleteUserTemplateFromCloud(userId)

      onTemplateSaved?.({
        mode: 'standard',
        files: [],
        filename: '',
        fileCount: 0,
        isOneOff: false,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove template')
    } finally {
      setSaving(false)
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
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 text-lg shadow-2xs">
              📄
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isCustomActive ? 'Hospital Template' : 'Add Hospital Template'}
              </h2>
              <p className="text-xs text-slate-500">
                {isCustomActive
                  ? 'Your hospital discharge format'
                  : 'Upload your hospital format (.docx, .pdf, or scan)'}
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
        <div className="overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {stagedFiles.length === 0 ? (
            isCustomActive ? (
              /* Active Saved Profile Template Card */
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Currently Saved Template</span>
                  <button
                    type="button"
                    onClick={handleTriggerReplace}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                  >
                    Replace File
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 p-3.5 text-xs shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-xs uppercase">
                      {(currentTemplate.filename || '').split('.').pop() || 'DOC'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {currentTemplate.filename || 'Custom Hospital Template'}
                      </p>
                      <p className="text-[11px] text-teal-600 font-medium">
                        Saved in Profile · Automatically applied for all discharges
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadExisting}
                    disabled={downloading}
                    className="ml-2 inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                    title="Download active template file from cloud"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{downloading ? 'Downloading…' : 'Download'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  To change or replace this template, tap <strong>Replace File</strong> above.
                </p>
              </div>
            ) : (
              /* Empty State: Dropzone */
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 text-center hover:border-teal-500 hover:bg-teal-50/30 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 mb-2 shadow-2xs">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Upload Hospital Template
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Word (.docx), PDF (.pdf), or photos of your hospital's blank summary sheet
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
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
            <div className="space-y-4">
              {(() => {
                const isImageTemplate =
                  stagedFiles.length > 0 && stagedFiles.every((f) => getCategory(f) === 'image')

                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {isImageTemplate
                          ? `Template Scans (${stagedFiles.length} page${stagedFiles.length === 1 ? '' : 's'})`
                          : 'Template Document'}
                      </span>
                      <button
                        type="button"
                        onClick={handleTriggerReplace}
                        className="font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                      >
                        {isImageTemplate ? 'Replace All' : 'Replace File'}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                      {stagedFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800 font-bold text-[10px] uppercase">
                              {file.name.split('.').pop() || (isImageTemplate ? 'IMG' : 'DOC')}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {isImageTemplate ? `Page ${idx + 1}: ${file.name}` : file.name}
                              </p>
                              <p className="text-[11px] text-slate-400">{formatBytes(file.size)}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setStagedFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                            title="Remove this page"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {isImageTemplate && (
                      <button
                        type="button"
                        onClick={handleTriggerAddMore}
                        className="w-full mt-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/60 py-2.5 text-xs font-semibold text-teal-700 hover:bg-teal-100/70 hover:border-teal-400 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>+ Add More Pages</span>
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* 2 Clear Options: Just for now vs Save for later */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  How would you like to use this template?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Just for this discharge */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setApplyScope('one_off')}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setApplyScope('one_off')}
                    className={`cursor-pointer rounded-xl border-2 p-3 transition-all ${
                      applyScope === 'one_off'
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-2 ring-teal-600/10'
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
                    className={`cursor-pointer rounded-xl border-2 p-3 transition-all ${
                      applyScope === 'default'
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-2 ring-teal-600/10'
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
              Remove Template
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
                {saving ? 'Applying…' : 'Apply Template'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
