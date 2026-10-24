import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getStoredDoctorPhone, isDashboardAllowedUser } from '../config.js'
import { downloadDoctorTemplateFile } from '../api/dischargeApi.js'
import { usePwaInstall } from '../hooks/usePwaInstall.js'

export default function AccountMenu({
  userId,
  currentTemplate = { mode: 'standard', filename: '' },
  isOpen: controlledIsOpen,
  onOpenChange,
  onOpenTemplateManager,
  onLogout,
}) {
  const isControlled = controlledIsOpen !== undefined
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen
  const setIsOpen = (next) => {
    const val = typeof next === 'function' ? next(isOpen) : next
    if (isControlled) {
      onOpenChange?.(val)
    } else {
      setInternalIsOpen(val)
    }
  }

  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const menuRef = useRef(null)

  const { canInstall, isInstalled, isIos, isMobile, promptInstall } = usePwaInstall()

  const doctorPhone = getStoredDoctorPhone()
  const displayPhone = doctorPhone
    ? `+91 ••••• •${doctorPhone.replace(/\D/g, '').slice(-4)}`
    : `Doctor Profile`

  const isCustomTemplate = Boolean(
    currentTemplate?.mode === 'custom' ||
    Boolean(currentTemplate?.filename) ||
    Boolean(currentTemplate?.files?.length)
  )

  const templateName = isCustomTemplate
    ? currentTemplate?.filename || 'Custom Template'
    : 'Standard Format'

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Close when clicking outside menu within header
  useEffect(() => {
    if (!isOpen) return

    function handleOutsidePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown)
  }, [isOpen])

  const handleLogoutClick = () => {
    setIsOpen(false)
    if (window.confirm('Log out from this doctor profile on this device?')) {
      onLogout?.()
    }
  }

  const handleDownload = async (e) => {
    e.stopPropagation()
    if (!userId && !currentTemplate?.files?.length) return
    setDownloading(true)
    try {
      if (currentTemplate?.files?.[0]) {
        const file = currentTemplate.files[0]
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = currentTemplate.filename || file.name || 'sample-discharge'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setDownloadSuccess(true)
        setTimeout(() => setDownloadSuccess(false), 2000)
        return
      }

      const { blob, filename } = await downloadDoctorTemplateFile(userId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || currentTemplate.filename || 'sample-discharge'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 2000)
    } catch (err) {
      console.warn('Failed to download template:', err)
      alert(err instanceof Error ? err.message : 'Failed to download template file')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Invisible Fullscreen Backdrop: Intercepts outside clicks & taps to prevent penetrating to dropzone */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-30 bg-transparent cursor-default select-none"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsOpen(false)
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onTouchStart={(e) => {
              e.stopPropagation()
            }}
            aria-hidden="true"
          />,
          document.body
        )}

      {/* Trigger Button: Minimal Hamburger / Settings Menu */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative ${isOpen ? 'z-50' : ''} flex h-8.5 w-8.5 sm:h-9.5 sm:w-9.5 cursor-pointer items-center justify-center rounded-xl border transition-all duration-150 shadow-2xs active:scale-95 shrink-0 ${
          isOpen
            ? 'border-slate-300 bg-slate-100 text-slate-700'
            : 'border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
        aria-label="Account and settings menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Menu"
      >
        {isOpen ? (
          <svg className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Doctor Profile Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200/80 shadow-2xs">
              Dr
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 font-mono tracking-normal truncate">
                {displayPhone}
              </div>
            </div>
          </div>

          {/* Sample Discharge Section */}
          <div className="p-3 border-b border-slate-100">
            <div className="mb-2 px-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sample Discharge
              </span>
            </div>

            {/* Template Card */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 transition-colors hover:border-slate-300">
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => {
                  setIsOpen(false)
                  onOpenTemplateManager?.()
                }}
                title="Click to edit template"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 shadow-2xs">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={templateName}>
                    {templateName}
                  </p>
                </div>
              </div>

              {/* Direct Quick Actions: Download & Edit */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading || !isCustomTemplate}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg border py-1.5 px-2 text-xs font-medium shadow-2xs transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    downloadSuccess
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold'
                      : downloading
                        ? 'border-slate-200 bg-slate-50 text-slate-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100'
                  }`}
                  title={isCustomTemplate ? 'Download active template' : 'Upload a custom template to download'}
                >
                  {downloadSuccess ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Downloaded</span>
                    </>
                  ) : downloading ? (
                    <>
                      <svg className="h-3.5 w-3.5 text-slate-400 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Downloading…</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onOpenTemplateManager?.()
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Edit or change sample discharge template"
                >
                  <svg className="h-3.5 w-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Menu Options */}
          <div className="px-2 pb-2 space-y-0.5 border-t border-slate-100/80 pt-1.5">
            {/* Install PWA Option */}
            {!isInstalled && (canInstall || isIos || isMobile) && (
              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false)
                  await promptInstall()
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-left"
              >
                <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Install App</span>
              </button>
            )}

            {/* Admin Dashboard if allowed */}
            {isDashboardAllowedUser(userId) && (
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors text-left"
              >
                <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Analytics Dashboard</span>
              </Link>
            )}

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
