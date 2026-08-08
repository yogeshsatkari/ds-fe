import { Link } from 'react-router-dom'

function NewSummaryLink() {
  return (
    <Link
      to="/"
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 sm:py-1.5"
    >
      New summary
    </Link>
  )
}

export default function EditSummaryHeader({ downloads = null, showNewSummary = true }) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center justify-between gap-3 sm:min-w-0">
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              Edit discharge summary
            </h1>
            {showNewSummary && <div className="sm:hidden">{<NewSummaryLink />}</div>}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            {downloads}
            {showNewSummary && <div className="hidden sm:block">{<NewSummaryLink />}</div>}
          </div>
        </div>
      </div>
    </header>
  )
}
