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

const segmentClass =
  'inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-clinical-50 hover:text-clinical-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:py-1.5'

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
      className="no-print inline-flex w-full overflow-hidden rounded-md border border-slate-200 bg-white sm:w-auto"
      role="group"
      aria-label="Download summary"
    >
      <button
        type="button"
        onClick={onDownloadDocx}
        disabled={disabled || busy}
        className={`${segmentClass} border-r border-slate-200`}
      >
        <DownloadIcon />
        <span>{downloading ? 'Preparing…' : 'DOCX'}</span>
      </button>
      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={disabled || busy}
        className={segmentClass}
      >
        <DownloadIcon />
        <span>{convertingPdf ? 'Converting…' : 'PDF'}</span>
      </button>
    </div>
  )
}
