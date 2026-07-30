export default function LoadingPanel({ title, message, warning }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-8 text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-clinical-600" />
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
      {warning && (
        <p className="mt-3 text-xs font-medium text-amber-700 bg-amber-50 rounded-md px-3 py-2 inline-block">
          {warning}
        </p>
      )}
    </div>
  )
}
