import { Link } from 'react-router-dom'

function NewSummaryLink() {
  return (
    <Link
      to="/"
      className="inline-flex h-8 sm:h-8.5 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-medium text-slate-600 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 active:scale-98 whitespace-nowrap"
      title="Create new discharge summary"
    >
      New summary
    </Link>
  )
}

export default function EditSummaryHeader({ downloads = null, showNewSummary = true }) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Row 1 on Mobile: Title on Left, New Summary on Right */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              Edit discharge summary
            </h1>
            {showNewSummary && (
              <div className="sm:hidden shrink-0">
                <NewSummaryLink />
              </div>
            )}
          </div>

          {/* Row 2 on Mobile (Full width downloads), Right side on Desktop */}
          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            {downloads}
            {showNewSummary && (
              <div className="hidden sm:block shrink-0">
                <NewSummaryLink />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
