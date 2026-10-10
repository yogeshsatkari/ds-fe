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

export default function PastPatientsList({ patients, loading = false, error = null, onSelect }) {
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

          return (
            <li key={patient.patient_id}>
              <button
                type="button"
                disabled={!canOpen}
                onClick={() => onSelect?.(patient)}
                className="flex w-full cursor-pointer flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-slate-900">{title}</span>
                  {formattedCreated && (
                    <span
                      className="shrink-0 text-xs text-slate-400"
                      title={
                        rawDate
                          ? `Created: ${new Date(rawDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                          : undefined
                      }
                    >
                      {formattedCreated}
                    </span>
                  )}
                </div>

                {meta && <span className="truncate text-xs text-slate-500">{meta}</span>}
                {dates && <span className="truncate text-xs text-slate-400">{dates}</span>}
                {!canOpen && (
                  <span className="text-xs text-amber-700">Summary not available yet</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
