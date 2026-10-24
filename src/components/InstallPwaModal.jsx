import { useEffect } from 'react'

export default function InstallPwaModal({ isOpen, onClose, onInstall, isIos, canInstall }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

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
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-100"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand App Icon & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 text-white shadow-xs">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 4.5a1.5 1.5 0 0 0-3 0v4H3.5a1.5 1.5 0 0 0 0 3h4v4a1.5 1.5 0 0 0 3 0v-4h4a1.5 1.5 0 0 0 0-3h-4v-4z"
                fill="currentColor"
              />
              <path
                d="M18.5 2.5c0 2.2 1.6 3.8 3.8 3.8-2.2 0-3.8 1.6-3.8 3.8 0-2.2-1.6-3.8-3.8-3.8 2.2 0 3.8-1.6 3.8-3.8z"
                fill="currentColor"
                className="text-emerald-200"
              />
              <circle cx="20" cy="14" r="1" fill="currentColor" opacity="0.85" className="text-cyan-100" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">Install Discharge AI</h3>
            <p className="text-xs text-slate-500">Fast, standalone access on your device</p>
          </div>
        </div>

        {/* Platform Guidance */}
        {isIos ? (
          <div className="space-y-3.5 my-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Install this app on your iPhone or iPad for a full-screen clinical experience:
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-[11px]">
                  1
                </span>
                <span>
                  Tap the <strong className="text-slate-900">Share</strong> button{' '}
                  <svg
                    className="inline-block h-4 w-4 text-teal-600 align-text-bottom mx-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>{' '}
                  in Safari's bottom toolbar.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-[11px]">
                  2
                </span>
                <span>
                  Scroll down and choose <strong className="text-slate-900">Add to Home Screen</strong>.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-[11px]">
                  3
                </span>
                <span>
                  Tap <strong className="text-teal-700">Add</strong> in the top-right corner.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer mt-3"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="space-y-4 my-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Install Discharge AI to launch instantly from your home screen or desktop taskbar with offline shell support.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (canInstall) {
                    await onInstall()
                  }
                  onClose()
                }}
                className="flex-1 rounded-xl bg-teal-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors cursor-pointer"
              >
                Install Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
