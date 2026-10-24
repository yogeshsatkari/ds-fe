import { useEffect, useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall.js'
import InstallPwaModal from './InstallPwaModal.jsx'

export default function PwaInstallBanner() {
  const { canInstall, isInstalled, isIos, isMobile, promptInstall } = usePwaInstall()
  const [showBanner, setShowBanner] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // If already installed as PWA or user previously dismissed, don't auto-popup
    if (isInstalled) return
    // Allow effortless testing with ?install or ?reset in URL
    if (window.location.search.includes('install') || window.location.search.includes('reset')) {
      try {
        localStorage.removeItem('pwa_banner_dismissed')
      } catch {}
    }

    const dismissed = localStorage.getItem('pwa_banner_dismissed') === 'true'
    if (dismissed) return

    // Show banner after 1s delay on mobile devices or if install prompt is ready
    if (canInstall || isIos || isMobile) {
      const timer = setTimeout(() => setShowBanner(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [canInstall, isInstalled, isIos, isMobile])

  const handleDismiss = () => {
    setShowBanner(false)
    try {
      localStorage.setItem('pwa_banner_dismissed', 'true')
    } catch {
      // ignore storage errors
    }
  }

  const handleInstallClick = async () => {
    if (isIos) {
      setShowModal(true)
    } else if (canInstall) {
      const accepted = await promptInstall()
      if (accepted) {
        setShowBanner(false)
      }
    } else {
      setShowModal(true)
    }
  }

  if (isInstalled || !showBanner) return null

  return (
    <>
      <div
        role="region"
        aria-label="Install App Banner"
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="relative flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg backdrop-blur-md ring-1 ring-slate-900/5">
          {/* Text Info */}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
              Install App
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5 truncate sm:overflow-visible">
              Add to home screen for faster clinical access
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all whitespace-nowrap"
            >
              Install App
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Dismiss banner"
              title="Not now"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* iOS or Fallback Instruction Modal */}
      <InstallPwaModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          handleDismiss()
        }}
        onInstall={promptInstall}
        isIos={isIos}
        canInstall={canInstall}
      />
    </>
  )
}
