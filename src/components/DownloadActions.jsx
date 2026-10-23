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

export default function DownloadActions({
  onDownloadDocx,
  onDownloadPdf,
  downloading = false,
  convertingPdf = false,
  disabled = false,
}) {
  const busy = downloading || convertingPdf

  return (
    <div
      className="no-print flex items-center gap-2 w-full sm:w-auto"
      role="group"
      aria-label="Download summary"
    >
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
