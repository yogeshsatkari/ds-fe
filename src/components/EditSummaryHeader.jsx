import { Link } from 'react-router-dom'

function NewSummaryLink() {
  return (
    <Link
      to="/"
      className="inline-flex h-8 sm:h-8.5 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 sm:px-3 text-xs font-medium text-slate-500 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 active:scale-98 whitespace-nowrap"
      title="Create new discharge summary"
    >
      <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span>New<span className="hidden xs:inline"> summary</span></span>
    </Link>
  )
}

export default function EditSummaryHeader({ downloads = null, showNewSummary = true }) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto max-w-7xl px-3.5 sm:px-6 py-2.5 sm:py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Header Title with Back Link */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to="/"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
              title="Back to generator"
              aria-label="Back to generator"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="min-w-0 truncate text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Edit Discharge Summary
            </h1>
          </div>

          {/* Action Bar (DOCX -> PDF -> New Summary in consistent priority order) */}
          <div className="flex w-full items-center gap-1.5 sm:gap-2 sm:w-auto sm:justify-end">
            {downloads}
            {showNewSummary && <NewSummaryLink />}
          </div>
        </div>
      </div>
    </header>
  )
}
