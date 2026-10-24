import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { editSummaryPath, fetchTemplateMd } from '../api/dischargeApi.js'
import { USD_TO_INR_RATE } from '../config.js'

function formatTokens(num) {
  if (num == null) return '—'
  return Number(num).toLocaleString('en-US')
}

function formatCostInr(val) {
  if (val == null) return '—'
  return `₹${Number(val).toFixed(2)}`
}

function formatCostUsd(val) {
  if (val == null) return '—'
  return `$${Number(val).toFixed(4)}`
}

function formatCreatedDateTime(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    const datePart = d.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const str = String(dateStr)
    const hasTime = str.includes(':') || str.includes('T')
    const timePart = hasTime
      ? d.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : null
    return timePart ? `${datePart}, ${timePart}` : datePart
  } catch {
    return String(dateStr)
  }
}

export default function TelemetryModal({ patient, metrics, userId, isOpen, onClose }) {
  const [templateMd, setTemplateMd] = useState(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Reset template preview state on patient change or modal close
  useEffect(() => {
    setTemplateMd(null)
    setShowTemplate(false)
    setLoadingTemplate(false)
  }, [patient?.patient_id, isOpen])

  if (!isOpen || !patient) return null

  const summary = metrics?.summary || {}
  const stage1 = metrics?.stages?.stage_1_ocr || {}
  const stageTemplate = metrics?.stages?.stage_template_extraction || null
  const stage2 = metrics?.stages?.stage_2_synthesis || {}
  const ocrPages = stage1.pages || []
  const modelName = summary.model || metrics?.model || 'gemini-2.5-flash'
  const status = metrics?.status || summary.status || (patient.has_summary ? 'completed' : 'pending')
  const isFailed = status === 'failed'

  const rawDate =
    patient.date_created ||
    patient.created_at ||
    patient.updated_at ||
    summary.created_at ||
    metrics?.created_at
  const createdStr = formatCreatedDateTime(rawDate)

  const handleToggleTemplate = async () => {
    if (showTemplate) {
      setShowTemplate(false)
      return
    }
    if (templateMd === null) {
      setLoadingTemplate(true)
      try {
        const text = await fetchTemplateMd(userId, patient.patient_id)
        setTemplateMd(text || 'No template markdown found.')
      } catch {
        setTemplateMd('Failed to load template markdown.')
      } finally {
        setLoadingTemplate(false)
      }
    }
    setShowTemplate(true)
  }

  const promptTokens = summary.prompt_tokens ?? 0
  const visibleTokens = summary.visible_tokens ?? 0
  const thoughtTokens = summary.thought_tokens ?? 0
  const totalTokens = summary.total_tokens || promptTokens + visibleTokens + thoughtTokens

  const promptPct = totalTokens > 0 ? Math.round((promptTokens / totalTokens) * 100) : 0
  const visiblePct = totalTokens > 0 ? Math.round((visibleTokens / totalTokens) * 100) : 0
  const thoughtPct = totalTokens > 0 ? Math.round((thoughtTokens / totalTokens) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="telemetry-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="telemetry-modal-title" className="text-lg font-semibold text-slate-900">
                {patient.patient_name || 'Unnamed Patient'}
              </h2>
              <span className="rounded bg-slate-200/80 px-2 py-0.5 text-xs font-mono font-medium text-slate-700">
                {patient.uhid_no ? `UHID: ${patient.uhid_no}` : patient.patient_id.slice(0, 8)}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${
                  isFailed
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {status}
              </span>
              <span className="rounded bg-clinical-50 border border-clinical-200 px-2 py-0.5 text-xs font-mono text-clinical-800">
                {modelName}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Patient ID: <span className="font-mono">{patient.patient_id}</span>
              {patient.discharge_type && (
                <span className="ml-2 uppercase tracking-wide">
                  · {patient.discharge_type} pipeline
                </span>
              )}
              {createdStr && (
                <span className="ml-2">
                  · Created: <span className="text-slate-700 font-medium">{createdStr}</span>
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {!metrics ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-sm font-medium text-amber-900">
                Telemetry record not found for this extraction.
              </p>
              <p className="mt-1 text-xs text-amber-700">
                This discharge summary may have been created before metrics recording was enabled.
              </p>
            </div>
          ) : (
            <>
              {/* Top High-level KPI summary row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                  <span className="text-xs font-medium text-slate-500">Total Duration</span>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {summary.total_duration_seconds != null
                      ? `${summary.total_duration_seconds.toFixed(1)}s`
                      : '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                  <span className="text-xs font-medium text-slate-500">Total Tokens</span>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {formatTokens(totalTokens)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                  <span className="text-xs font-medium text-slate-500">Total Cost (INR)</span>
                  <div className="mt-1 text-lg font-semibold text-clinical-700">
                    {formatCostInr(summary.total_cost_inr)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                  <span className="text-xs font-medium text-slate-500">Total Cost (USD)</span>
                  <div className="mt-1 text-lg font-semibold text-slate-700">
                    {formatCostUsd(summary.total_cost_usd)}
                  </div>
                </div>
              </div>

              {/* Token Distribution Breakdown */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span>Token Allocation</span>
                  <span className="font-mono text-slate-500">{formatTokens(totalTokens)} total</span>
                </div>
                {/* Visual bar */}
                <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{ width: `${promptPct}%` }}
                    className="bg-blue-500"
                    title={`Prompt: ${formatTokens(promptTokens)} (${promptPct}%)`}
                  />
                  <div
                    style={{ width: `${thoughtPct}%` }}
                    className="bg-purple-500"
                    title={`Thought (Reasoning): ${formatTokens(thoughtTokens)} (${thoughtPct}%)`}
                  />
                  <div
                    style={{ width: `${visiblePct}%` }}
                    className="bg-emerald-500"
                    title={`Output (Visible): ${formatTokens(visibleTokens)} (${visiblePct}%)`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600">
                      Input: <b className="text-slate-800">{formatTokens(promptTokens)}</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                    <span className="text-slate-600">
                      Reasoning: <b className="text-slate-800">{formatTokens(thoughtTokens)}</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">
                      Output: <b className="text-slate-800">{formatTokens(visibleTokens)}</b>
                    </span>
                  </div>
                </div>
              </div>

              {/* Two-Stage Execution Breakdown */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Pipeline Stage Breakdown
                </h3>
                <div className={`grid grid-cols-1 gap-4 ${stageTemplate ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {/* Stage 1: OCR */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                          1
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Stage 1: Multi-Page OCR
                        </h4>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {stage1.total_pages ?? ocrPages.length} pages
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-slate-400">Duration:</span>
                        <p className="font-medium text-slate-800">
                          {stage1.duration_seconds != null ? `${stage1.duration_seconds}s` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Stage Cost:</span>
                        <p className="font-semibold text-clinical-700">
                          {formatCostInr(stage1.cost_inr)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Input Tokens:</span>
                        <p className="font-medium text-slate-800">{formatTokens(stage1.prompt_tokens)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Reasoning Tokens:</span>
                        <p className="font-medium text-purple-700">{formatTokens(stage1.thought_tokens)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Visible Tokens:</span>
                        <p className="font-medium text-emerald-700">
                          {formatTokens(stage1.visible_tokens ?? stage1.output_tokens)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stage 1b: Template Ingestion (if custom template was used) */}
                  {stageTemplate && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-700">
                            1b
                          </span>
                          <h4 className="text-sm font-semibold text-purple-950">
                            Stage 1b: Template Ingestion
                          </h4>
                        </div>
                        <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-[11px] font-medium uppercase">
                          {stageTemplate.status || 'success'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-t border-purple-100 pt-3">
                        <div>
                          <span className="text-slate-400">Duration:</span>
                          <p className="font-medium text-slate-800">
                            {stageTemplate.duration_seconds != null ? `${stageTemplate.duration_seconds}s` : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Stage Cost:</span>
                          <p className="font-semibold text-clinical-700">
                            {formatCostInr(stageTemplate.cost_inr)}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Input Tokens:</span>
                          <p className="font-medium text-slate-800">{formatTokens(stageTemplate.prompt_tokens)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Reasoning Tokens:</span>
                          <p className="font-medium text-purple-700">{formatTokens(stageTemplate.thought_tokens)}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Visible Tokens:</span>
                          <p className="font-medium text-emerald-700">
                            {formatTokens(stageTemplate.visible_tokens ?? stageTemplate.output_tokens)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stage 2: Synthesis */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                          {stageTemplate ? '3' : '2'}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Stage 2: Clinical Synthesis
                        </h4>
                      </div>
                      <span className="rounded bg-clinical-50 text-clinical-700 border border-clinical-200 px-2 py-0.5 text-[11px] font-medium uppercase">
                        {stage2.status || 'success'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-t border-slate-100 pt-3">
                      <div>
                        <span className="text-slate-400">Duration:</span>
                        <p className="font-medium text-slate-800">
                          {stage2.duration_seconds != null ? `${stage2.duration_seconds}s` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Stage Cost:</span>
                        <p className="font-semibold text-clinical-700">
                          {formatCostInr(stage2.cost_inr)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Input Tokens:</span>
                        <p className="font-medium text-slate-800">{formatTokens(stage2.prompt_tokens)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Reasoning Tokens:</span>
                        <p className="font-medium text-purple-700">{formatTokens(stage2.thought_tokens)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Visible Tokens:</span>
                        <p className="font-medium text-emerald-700">
                          {formatTokens(stage2.visible_tokens ?? stage2.output_tokens)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Custom Template Viewer */}
              {(stageTemplate || patient.discharge_type === 'custom') && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📋</span>
                      <div>
                        <h4 className="text-xs font-semibold text-purple-900">
                          Custom Discharge Template Markdown
                        </h4>
                        <p className="text-[11px] text-purple-700">
                          Structure parsed from the doctor&apos;s template sample to guide this summary.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleTemplate}
                      disabled={loadingTemplate}
                      className="cursor-pointer rounded-md border border-purple-300 bg-white px-3 py-1 text-xs font-medium text-purple-800 shadow-2xs hover:bg-purple-50 transition-colors"
                    >
                      {loadingTemplate
                        ? 'Loading…'
                        : showTemplate
                          ? 'Hide Template Structure'
                          : 'View Template Structure'}
                    </button>
                  </div>
                  {showTemplate && templateMd && (
                    <div className="mt-3 overflow-hidden rounded-md border border-purple-200 bg-white">
                      <pre className="max-h-60 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {templateMd}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Page-by-Page OCR Table */}
              {ocrPages.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                    Page-by-Page OCR Metrics ({ocrPages.length} Pages)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-700">
                        <tr>
                          <th className="px-3.5 py-2.5">Page</th>
                          <th className="px-3.5 py-2.5">Document File</th>
                          <th className="px-3.5 py-2.5">Duration</th>
                          <th className="px-3.5 py-2.5">Input Tokens</th>
                          <th className="px-3.5 py-2.5">Reasoning Tokens</th>
                          <th className="px-3.5 py-2.5">Visible Tokens</th>
                          <th className="px-3.5 py-2.5 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {ocrPages.map((page, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="px-3.5 py-2 font-mono font-medium text-slate-600">
                              #{page.page_num ?? idx + 1}
                            </td>
                            <td className="px-3.5 py-2 font-medium text-slate-800 truncate max-w-xs">
                              {page.filename || `Page ${idx + 1}`}
                            </td>
                            <td className="px-3.5 py-2 text-slate-600">
                              {page.duration_seconds != null ? `${page.duration_seconds.toFixed(1)}s` : '—'}
                            </td>
                            <td className="px-3.5 py-2 text-slate-600 font-mono">
                              {formatTokens(page.prompt_tokens)}
                            </td>
                            <td className="px-3.5 py-2 text-purple-700 font-mono">
                              {formatTokens(page.thought_tokens)}
                            </td>
                            <td className="px-3.5 py-2 text-emerald-700 font-mono">
                              {formatTokens(page.visible_tokens ?? page.output_tokens)}
                            </td>
                            <td className="px-3.5 py-2 text-right font-semibold text-clinical-700 font-mono">
                              {formatCostInr(page.cost_inr)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Token Economics Explainer Card */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                  <svg className="h-4 w-4 text-clinical-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Google Gemini 2.5 Flash Pricing Standard</span>
                </div>
                <p>
                  Costs are calculated at standard Gemini API pricing: <b>$0.30 per 1M input tokens</b> and{' '}
                  <b>$2.50 per 1M output & reasoning tokens</b> (including Thinking budget), pegged at approximately ₹{USD_TO_INR_RATE.toFixed(2)} INR / USD.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          {patient.has_summary !== false && (
            <Link
              to={editSummaryPath(userId, patient.patient_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-clinical-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-clinical-700 transition-colors shadow-xs"
            >
              <span>Open Document Editor</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
