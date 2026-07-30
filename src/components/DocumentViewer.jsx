export default function DocumentViewer({ url, title }) {
  if (!url) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 bg-slate-50">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-clinical-600 hover:text-clinical-700"
        >
          Open in new tab
        </a>
      </div>
      <iframe
        src={url}
        title={title}
        className="w-full h-[min(70vh,600px)] border-0 bg-white"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  )
}
