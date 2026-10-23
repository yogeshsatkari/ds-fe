import { useState, useRef, useEffect } from 'react'
import { getStoredDoctorPhone } from '../config.js'

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
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
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-98"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50 text-teal-700 text-sm font-bold">
          🩺
        </span>
        <span className="hidden sm:inline font-semibold text-slate-800">
          {doctorPhone ? `+91 …${doctorPhone.slice(-4)}` : 'Doctor Account'}
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-slate-100 bg-white shadow-xl ring-1 ring-slate-900/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Account Profile Header */}
          <div className="border-b border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 text-xl font-bold shadow-2xs">
                👨‍⚕️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">
                  Doctor Profile
                </p>
                <p className="text-[11px] font-mono text-slate-500 truncate">
                  {displayPhone}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-1.5 space-y-0.5">
            {/* Add or Update Custom Template */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onOpenTemplateManager?.()
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-slate-700 hover:bg-teal-50/60 hover:text-teal-900 transition-colors text-left"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                {currentTemplate.mode === 'custom' ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">
                  {currentTemplate.mode === 'custom' ? 'Update Template' : 'Add Custom Template'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {currentTemplate.mode === 'custom'
                    ? currentTemplate.filename || 'Hospital Template'
                    : 'Upload your hospital format'}
                </p>
              </div>
            </button>
          </div>

          {/* Logout Footer */}
          <div className="border-t border-slate-100 p-1.5 bg-slate-50/40">
            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
