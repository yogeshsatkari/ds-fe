import { useState } from 'react'
import { getStoredUserId } from '../config.js'
import { shareDischargeSummary } from '../utils/shareUtils.js'

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

function patientMeta(patient) {
  return [patient.age, patient.sex, patient.uhid_no ? `UHID ${patient.uhid_no}` : null]
    .filter(Boolean)
    .join(' · ')
}

function stayDates(patient) {
  const parts = []
  if (patient.date_of_admission) parts.push(`Admitted ${patient.date_of_admission}`)
  if (patient.date_of_discharge) parts.push(`Discharged ${patient.date_of_discharge}`)
  return parts.join(' · ')
}

function formatDateCreated(dateStr) {
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
    const timePart = d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `${datePart}, ${timePart}`
  } catch {
    return String(dateStr)
  }
}

function SkeletonRow() {
  return (
    <li className="px-4 py-3" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-2/5 max-w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-3 w-3/5 max-w-64 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/2 max-w-56 animate-pulse rounded bg-slate-100" />
      </div>
    </li>
  )
}

export default function PastPatientsList({
  patients,
  loading = false,
  error = null,
  onSelect,
  userId = null,
}) {
  const [copiedId, setCopiedId] = useState(null)

  const handleSharePatient = async (patient, e) => {
    e.stopPropagation()
    const targetUserId = patient.user_id || userId || getStoredUserId()
    const result = await shareDischargeSummary({
      userId: targetUserId,
      patientId: patient.patient_id,
      patientName: patient.patient_name?.trim() || undefined,
    })

    if (result?.success) {
      setCopiedId(patient.patient_id)
      setTimeout(() => {
        setCopiedId((curr) => (curr === patient.patient_id ? null : curr))
      }, 2500)
    }
  }

  if (loading) {
    return (
      <section className="space-y-2 pt-4" aria-busy="true" aria-label="Loading previous discharge summaries">
        <h2 className="text-sm font-medium text-slate-700">Previous Discharges</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-2 pt-4">
        <h2 className="text-sm font-medium text-slate-700">Previous Discharges</h2> 
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Couldn’t load previous discharge summaries.
        </div>
      </section>
    )
  }

  if (!patients.length) {
    return null
  }

  return (
    <section className="space-y-2 pt-4">
      <h2 className="text-sm font-medium text-slate-700">Previous Discharges</h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {patients.map((patient) => {
          const title = patient.patient_name?.trim() || 'Unnamed patient'
          const meta = patientMeta(patient)
          const dates = stayDates(patient)
          const canOpen = patient.has_summary !== false
          const rawDate = patient.date_created || patient.created_at || patient.updated_at
          const formattedCreated = formatDateCreated(rawDate)
          const isCopied = copiedId === patient.patient_id

          return (
            <li key={patient.patient_id} className="group hover:bg-slate-50/80 transition-colors">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                {/* Clickable Card Body (Opens Document) */}
                <button
                  type="button"
                  disabled={!canOpen}
                  onClick={() => onSelect?.(patient)}
                  className={`flex flex-1 min-w-0 flex-col gap-0.5 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                      {title}
                    </span>
                  </div>

                  {meta && <span className="truncate text-xs text-slate-500">{meta}</span>}
                  {dates && <span className="truncate text-xs text-slate-400">{dates}</span>}
                  {!canOpen && (
                    <span className="text-xs text-amber-700">Summary not available yet</span>
                  )}
                </button>

                {/* Right Actions: Date & Share Icon */}
                <div className="flex items-center gap-2.5 shrink-0 ml-2">
                  {formattedCreated && (
                    <span
                      className="hidden sm:inline text-xs text-slate-400"
                      title={
                        rawDate
                          ? `Created: ${new Date(rawDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                          : undefined
                      }
                    >
                      {formattedCreated}
                    </span>
                  )}

                  {canOpen && (
                    <button
                      type="button"
                      onClick={(e) => handleSharePatient(patient, e)}
                      className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all active:scale-95 ${
                        isCopied
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 hover:border-slate-300'
                      }`}
                      title="Share summary link via WhatsApp, Telegram, or copy to clipboard"
                    >
                      {isCopied ? (
                        <>
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-[11px] font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <ShareIcon className="h-3.5 w-3.5 text-slate-500" />
                          <span className="hidden sm:inline text-[11px]">Share</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
