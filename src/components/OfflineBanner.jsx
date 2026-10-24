import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showRestored, setShowRestored] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
      setShowRestored(true)
      const timer = setTimeout(() => setShowRestored(false), 3000)
      return () => clearTimeout(timer)
    }

    function handleOffline() {
      setIsOffline(true)
      setShowRestored(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline && !showRestored) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full shadow-md text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        backgroundColor: isOffline ? '#fffbeb' : '#f0fdf4',
        border: `1px solid ${isOffline ? '#fde68a' : '#bbf7d0'}`,
        color: isOffline ? '#92400e' : '#166534',
      }}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
        }`}
      />
      <span>
        {isOffline
          ? 'You are offline. Reconnecting to clinical network…'
          : 'Back online'}
      </span>
    </div>
  )
}
