import { Link } from 'react-router-dom'
import DocxSummaryEditor from '../components/DocxSummaryEditor.jsx'

export default function EditPage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                Edit discharge summary
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Review and edit the summary. Download as DOCX or print to save as PDF.
              </p>
            </div>
            <Link
              to="/"
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Back to workflow
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="no-print mb-4 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Prototype: loading the sample{' '}
          <span className="font-mono text-xs">discharge-summary.docx</span>. When the backend
          returns DOCX, this page will open that file instead.
        </div>

        <DocxSummaryEditor />
      </main>
    </div>
  )
}
