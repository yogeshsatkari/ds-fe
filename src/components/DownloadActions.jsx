import { useState } from 'react'

function DownloadIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.3 8.49a.75.75 0 0 0-1.1 1.02l4.25 4.5a.75.75 0 0 0 1.1 0l4.25-4.5a.75.75 0 1 0-1.1-1.02l-2.95 3.12V2.75Z" />
      <path d="M3.5 14.75a.75.75 0 0 0-1.5 0v.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-.5a.75.75 0 0 0-1.5 0v.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-.5Z" />
    </svg>
  )
}

function ShareIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function CheckIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function DownloadActions({
  onDownloadDocx,
  onDownloadPdf,
  onShare,
  downloading = false,
  convertingPdf = false,
  disabled = false,
}) {
  const busy = downloading || convertingPdf
  const [copied, setCopied] = useState(false)

  const handleShareClick = async () => {
    if (!onShare || disabled) return
    const result = await onShare()
    if (result?.success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div
      className="no-print flex items-center gap-2 w-full sm:w-auto"
      role="group"
      aria-label="Document actions"
    >
      {/* Share / Copy Link Action */}
      {onShare && (
        <button
          type="button"
          onClick={handleShareClick}
          disabled={disabled}
          className={`inline-flex h-8 sm:h-8.5 flex-1 sm:flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 sm:px-3.5 text-xs font-semibold shadow-2xs transition-all active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap ${
            copied
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
              : 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Share summary via WhatsApp, Telegram, or copy link"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <ShareIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>Share</span>
            </>
          )}
        </button>
      )}

      {/* Primary Action (Main): DOCX */}
      <button
        type="button"
        onClick={onDownloadDocx}
        disabled={disabled || busy}
        className="inline-flex h-8 sm:h-8.5 flex-1 sm:flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-clinical-600 bg-clinical-600 px-3 sm:px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-clinical-700 hover:border-clinical-700 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
      >
        <DownloadIcon className="h-3.5 w-3.5 text-white shrink-0" />
        <span>{downloading ? 'Preparing…' : 'DOCX'}</span>
      </button>

      {/* Secondary Action: PDF */}
      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={disabled || busy}
        className="inline-flex h-8 sm:h-8.5 flex-1 sm:flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 sm:px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
      >
        <DownloadIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span>{convertingPdf ? 'Converting…' : 'PDF'}</span>
      </button>
    </div>
  )
}
