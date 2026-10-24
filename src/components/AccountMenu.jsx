import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getStoredDoctorPhone, isDashboardAllowedUser } from '../config.js'

export default function AccountMenu({
  userId,
  currentTemplate = { mode: 'standard', filename: '' },
  onOpenTemplateManager,
  onLogout,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const doctorPhone = getStoredDoctorPhone()
  const displayPhone = doctorPhone
    ? `+91 ••••• •${doctorPhone.slice(-4)}`
    : `Dr. (${(userId || '').slice(0, 6)}…)`

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

  const handleLogoutClick = () => {
    setIsOpen(false)
    if (window.confirm('Log out from this doctor profile on this device?')) {
      onLogout?.()
    }
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Invisible Fullscreen Backdrop: Intercepts outside clicks & taps to prevent penetrating to dropzone */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-transparent cursor-default select-none"
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

      {/* Trigger Button: Clean Minimalist Avatar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative ${isOpen ? 'z-50' : ''} flex h-8.5 w-8.5 sm:h-9 sm:w-9 cursor-pointer items-center justify-center rounded-full border transition-all duration-150 shadow-2xs active:scale-95 shrink-0 ${
          isOpen
            ? 'border-teal-500 bg-teal-50 text-teal-700 ring-2 ring-teal-500/20'
            : 'border-slate-200/90 bg-white text-slate-600 hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-700'
        }`}
        aria-label="Doctor profile menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Doctor Profile"
      >
        <svg className="h-4.5 w-4.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-900/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Subtle Doctor Account Header */}
          <div className="flex items-center gap-1.5 border-b border-slate-100/80 bg-slate-50/40 px-3.5 py-1.5">
            <span className="text-xs select-none opacity-50 leading-none shrink-0" aria-hidden="true">
              👨‍⚕️
            </span>
            <span className="text-[11px] font-medium text-slate-400 truncate tracking-tight">
              {displayPhone}
            </span>
          </div>

          {/* Featured Hero: Sample Discharge Format */}
          <div className="p-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsOpen(false)
                onOpenTemplateManager?.()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setIsOpen(false)
                  onOpenTemplateManager?.()
                }
              }}
              className="group cursor-pointer rounded-xl border border-teal-200/90 bg-gradient-to-br from-teal-50/80 via-white to-emerald-50/40 p-3 shadow-2xs transition-all hover:border-teal-400 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-2xs">
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 block leading-tight">
                      Sample Discharge
                    </span>
                    <h4
                      className="text-xs font-bold text-slate-900 leading-tight truncate mt-0.5"
                      title={currentTemplate.filename || 'Standard Format'}
                    >
                      {currentTemplate.mode === 'custom' && (currentTemplate.filename || currentTemplate.files?.length > 0)
                        ? currentTemplate.filename || 'Custom Template'
                        : 'Default Institutional'}
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-teal-700 group-hover:text-teal-900 flex items-center gap-0.5 shrink-0 mt-0.5">
                  {currentTemplate.mode === 'custom' ? 'Change' : 'Add'} →
                </span>
              </div>
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="px-2 pb-2 space-y-0.5 border-t border-slate-100/80 pt-1.5">
            {/* Admin Dashboard if allowed */}
            {isDashboardAllowedUser(userId) && (
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors text-left"
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
