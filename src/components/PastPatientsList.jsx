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

export default function PastPatientsList({ patients, loading = false, error = null, onSelect }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Loading previous summaries…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
        Couldn’t load previous summaries.
      </div>
    )
  }

  if (!patients.length) {
    return null
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-slate-700">Previous summaries</h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {patients.map((patient) => {
          const title = patient.patient_name?.trim() || 'Unnamed patient'
          const meta = patientMeta(patient)
          const dates = stayDates(patient)
          const canOpen = patient.has_summary !== false

          return (
            <li key={patient.patient_id}>
              <button
                type="button"
                disabled={!canOpen}
                onClick={() => onSelect?.(patient)}
                className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="truncate text-sm font-medium text-slate-900">{title}</span>
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
