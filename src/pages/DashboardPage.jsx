import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  API_BASE_URL,
  clearDoctorAuth,
  getStoredUserId,
  isDashboardAllowedUser,
} from '../config.js'
import {
  editSummaryPath,
  fetchPatientMetrics,
} from '../api/dischargeApi.js'
import TelemetryModal from '../components/TelemetryModal.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import DoctorAuthCard from '../components/DoctorAuthCard.jsx'
import AccountMenu from '../components/AccountMenu.jsx'
import TemplateManagerModal from '../components/TemplateManagerModal.jsx'
import { getDoctorTemplate } from '../utils/templateStorage.js'

function formatTokensCompact(num) {
  if (num == null) return '—'
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
  return String(num)
}

function formatCostInr(val) {
  if (val == null) return '—'
  return `₹${Number(val).toFixed(2)}`
}

function formatCostUsd(val) {
  if (val == null) return '—'
  return `$${Number(val).toFixed(3)}`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState(getStoredUserId)
  const [patients, setPatients] = useState([])
  const [metricsMap, setMetricsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'standard' | 'custom'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'completed' | 'failed'
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'cost_high' | 'duration_fast' | 'pages_high'

  // Modal State
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Doctor Template State
  const [doctorTemplate, setDoctorTemplate] = useState({
    mode: 'standard',
    files: [],
    filename: '',
  })
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)

  useEffect(() => {
    if (userId) {
      getDoctorTemplate(userId).then((tpl) => {
        if (tpl) setDoctorTemplate(tpl)
      })
    }
  }, [userId])

  // Prevent duplicate metric fetches
  const checkedMetricsRef = useRef(new Set())

  const loadData = useCallback(async (activeUserId) => {
    const idToUse = activeUserId || userId
    if (!idToUse) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let res = await fetch(`${API_BASE_URL}/dashboard/patients`)
      if (!res.ok) {
        res = await fetch(`${API_BASE_URL}/users/${idToUse}/patients`)
      }
      if (!res.ok) {
        throw new Error(`Failed to load patient records (${res.status})`)
      }
      const data = await res.json()
      const patientList = data.patients ?? []

      setPatients(patientList)
      setLoading(false)

      // Only fetch metrics for patients we haven't checked yet
      patientList.forEach(async (p) => {
        if (!p.patient_id || checkedMetricsRef.current.has(p.patient_id)) return
        checkedMetricsRef.current.add(p.patient_id)

        try {
          const m = await fetchPatientMetrics(p.user_id || idToUse, p.patient_id)
          if (m) {
            setMetricsMap((prev) => ({ ...prev, [p.patient_id]: m }))
          }
        } catch {
          // Graceful fallback for legacy records
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patient records')
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId || !isDashboardAllowedUser(userId)) return
    loadData(userId)
  }, [userId, loadData])

  const handleSwitchAccount = () => {
    if (window.confirm('Log out from this device?')) {
      clearDoctorAuth()
      setUserId(null)
      checkedMetricsRef.current.clear()
      setPatients([])
      setMetricsMap({})
    }
  }

  // Aggregate KPIs calculated across all patients
  const kpis = useMemo(() => {
    let totalCostInr = 0
    let totalCostUsd = 0
    let totalDuration = 0
    let durationCount = 0
    let totalTokens = 0
    let promptTokens = 0
    let visibleTokens = 0
    let thoughtTokens = 0
    let completedCount = 0

    patients.forEach((p) => {
      const m = metricsMap[p.patient_id]
      if (m?.summary) {
        if (m.summary.total_cost_inr) totalCostInr += m.summary.total_cost_inr
        if (m.summary.total_cost_usd) totalCostUsd += m.summary.total_cost_usd
        if (m.summary.total_duration_seconds) {
          totalDuration += m.summary.total_duration_seconds
          durationCount += 1
        }
        if (m.summary.total_tokens) totalTokens += m.summary.total_tokens
        if (m.summary.prompt_tokens) promptTokens += m.summary.prompt_tokens
        if (m.summary.visible_tokens) visibleTokens += m.summary.visible_tokens
        if (m.summary.thought_tokens) thoughtTokens += m.summary.thought_tokens
        if (m.summary.status === 'completed' || m.status === 'completed') completedCount += 1
      } else if (p.has_summary) {
        completedCount += 1
      }
    })

    const avgDuration = durationCount > 0 ? (totalDuration / durationCount).toFixed(1) : '—'
    const avgCostInr = patients.length > 0 ? (totalCostInr / patients.length).toFixed(2) : '—'

    return {
      totalPatients: patients.length,
      completedCount,
      totalCostInr: totalCostInr.toFixed(2),
      totalCostUsd: totalCostUsd.toFixed(3),
      avgDuration,
      totalTokens,
      promptTokens,
      visibleTokens,
      thoughtTokens,
      avgCostInr,
    }
  }, [patients, metricsMap])

  // Filtered and Sorted Patient Rows
  const filteredPatients = useMemo(() => {
    return patients
      .filter((p) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const name = (p.patient_name || '').toLowerCase()
          const uhid = (p.uhid_no || '').toLowerCase()
          const pid = (p.patient_id || '').toLowerCase()
          if (!name.includes(q) && !uhid.includes(q) && !pid.includes(q)) {
            return false
          }
        }

        // Type filter
        if (typeFilter !== 'all') {
          const pType = (p.discharge_type || 'standard').toLowerCase()
          if (pType !== typeFilter) return false
        }

        // Status filter
        if (statusFilter !== 'all') {
          const m = metricsMap[p.patient_id]
          const isComplete = m?.status === 'completed' || (p.has_summary && m?.status !== 'failed')
          if (statusFilter === 'completed' && !isComplete) return false
          if (statusFilter === 'failed' && isComplete) return false
        }

        return true
      })
      .sort((a, b) => {
        const mA = metricsMap[a.patient_id]
        const mB = metricsMap[b.patient_id]

        if (sortBy === 'newest') {
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        }
        if (sortBy === 'cost_high') {
          const costA = mA?.summary?.total_cost_inr || 0
          const costB = mB?.summary?.total_cost_inr || 0
          return costB - costA
        }
        if (sortBy === 'duration_fast') {
          const durA = mA?.summary?.total_duration_seconds || 9999
          const durB = mB?.summary?.total_duration_seconds || 9999
          return durA - durB
        }
        if (sortBy === 'pages_high') {
          const pagesA = mA?.stages?.stage_1_ocr?.total_pages || 0
          const pagesB = mB?.stages?.stage_1_ocr?.total_pages || 0
          return pagesB - pagesA
        }
        return 0
      })
  }, [patients, metricsMap, searchQuery, typeFilter, statusFilter, sortBy])

  // 1. If not authenticated in localStorage, show sign-in option
  if (!userId) {
    return (
      <DoctorAuthCard
        title="Admin Sign In"
        description="Enter your mobile number and 4-digit PIN to access telemetry and analytics."
        buttonText="Access Dashboard →"
        showBackHome={true}
        onAuthSuccess={(newId) => {
          if (isDashboardAllowedUser(newId)) {
            setUserId(newId)
          } else {
            navigate('/', { replace: true })
          }
        }}
      />
    )
  }

  // 2. If authenticated, but not one of the specified allowed user IDs, silently redirect to /
  if (!isDashboardAllowedUser(userId)) {
    return <Navigate to="/" replace />
  }

  const handleOpenTelemetry = (patient) => {
    setSelectedPatient(patient)
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-svh bg-slate-50 text-slate-900 pb-12">
      {/* Top Application Navbar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 text-white font-bold text-sm shadow-xs">
                  DS
                </div>
                <div>
                  <h1 className="text-base font-semibold tracking-tight text-slate-900 leading-none">
                    Clinical AI Portal
                  </h1>
                  <span className="text-xs text-slate-500">Telemetry & Discharge Digitization</span>
                </div>
              </div>

           
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-clinical-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-clinical-700 transition-colors shadow-xs"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Discharge</span>
              </Link>

              <AccountMenu
                userId={userId}
                currentTemplate={doctorTemplate}
                onOpenTemplateManager={() => setIsTemplateModalOpen(true)}
                onLogout={handleSwitchAccount}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <ErrorAlert message={error} onDismiss={() => setError(null)} />

        {/* Top Aggregate KPI Cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {/* Card 1: Patients */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Patients</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                👤
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '—' : kpis.totalPatients}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {kpis.completedCount} processed successfully
            </p>
          </div>

          {/* Card 2: Total AI Spend */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total AI Spend</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 font-bold">
                ₹
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-clinical-700">
              {loading ? '—' : `₹${kpis.totalCostInr}`}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              ≈ ${kpis.totalCostUsd} USD
            </p>
          </div>

          {/* Card 3: Avg Processing Turnaround */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Avg Turnaround Time</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                ⚡
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '—' : kpis.avgDuration === '—' ? '—' : `${kpis.avgDuration}s`}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Per discharge summary
            </p>
          </div>

          {/* Card 4: Token Utilization */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Token Consumption</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600 font-mono text-[10px] font-bold">
                TOK
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '—' : formatTokensCompact(kpis.totalTokens)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate" title="Input vs Reasoning vs Output">
              In: {formatTokensCompact(kpis.promptTokens)} · Rsn: {formatTokensCompact(kpis.thoughtTokens)} · Out: {formatTokensCompact(kpis.visibleTokens)}
            </p>
          </div>

          {/* Card 5: Cost per Patient */}
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Avg Cost / Patient</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                📊
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {loading ? '—' : kpis.avgCostInr === '—' ? '—' : `₹${kpis.avgCostInr}`}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Combined OCR & synthesis
            </p>
          </div>
        </section>

        {/* Search, Filter, Sort Toolbar */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by Patient Name, UHID, or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-clinical-500 focus:bg-white focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="cursor-pointer absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="text-slate-400">Format:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <option value="all">All Formats</option>
                  <option value="standard">Standard (Markdown)</option>
                  <option value="custom">Custom (Template)</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="text-slate-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed / Partial</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="text-slate-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <option value="newest">Newest First</option>
                  <option value="cost_high">Highest Cost</option>
                  <option value="duration_fast">Fastest Turnaround</option>
                  <option value="pages_high">Most Pages</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <b className="text-slate-800">{filteredPatients.length}</b> of {patients.length} digitized patients
            </span>
            {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setTypeFilter('all')
                  setStatusFilter('all')
                }}
                className="cursor-pointer text-xs font-medium text-clinical-700 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </section>

        {/* Main Patients & Telemetry Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3.5">Patient Details</th>
                  <th className="px-4 py-3.5">Admission / Stay</th>
                  <th className="px-4 py-3.5">Pipeline Format</th>
                  <th className="px-4 py-3.5 text-center">Pages</th>
                  <th className="px-4 py-3.5">Processing Time</th>
                  <th className="px-4 py-3.5">Tokens Consumed</th>
                  <th className="px-4 py-3.5">AI Cost</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  // Skeleton Rows
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-4 py-4">
                        <div className="h-4 w-32 rounded bg-slate-200" />
                        <div className="mt-1.5 h-3 w-20 rounded bg-slate-100" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-3 w-24 rounded bg-slate-100" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-16 rounded bg-slate-200" />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="mx-auto h-4 w-6 rounded bg-slate-200" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-12 rounded bg-slate-200" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-16 rounded bg-slate-200" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-14 rounded bg-slate-200" />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="ml-auto h-6 w-20 rounded bg-slate-200" />
                      </td>
                    </tr>
                  ))
                ) : filteredPatients.length === 0 ? (
                  // Empty State
                  <tr>
                    <td colSpan="8" className="px-6 py-14 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        📋
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-900">
                        No digitized patients found
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                        {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                          ? 'No records match your active search and filter criteria.'
                          : 'Get started by uploading your first set of medical records to extract a discharge summary.'}
                      </p>
                      <Link
                        to="/"
                        className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-clinical-600 px-4 py-2 text-xs font-medium text-white hover:bg-clinical-700 transition-colors shadow-xs"
                      >
                        Create First Summary
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const metrics = metricsMap[patient.patient_id]
                    const summary = metrics?.summary || {}
                    const stage1 = metrics?.stages?.stage_1_ocr || {}
                    const pagesCount = stage1.total_pages ?? (stage1.pages ? stage1.pages.length : '—')

                    const totalTokens = summary.total_tokens
                    const promptTokens = summary.prompt_tokens
                    const thoughtTokens = summary.thought_tokens
                    const visibleTokens = summary.visible_tokens

                    const costInr = summary.total_cost_inr
                    const costUsd = summary.total_cost_usd
                    const durationSec = summary.total_duration_seconds

                    const isCustom = patient.discharge_type === 'custom'

                    return (
                      <tr key={patient.patient_id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Patient Details */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                              {patient.patient_name?.trim() || 'Unnamed Patient'}
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              {patient.uhid_no && (
                                <span className="font-mono text-slate-600">UHID: {patient.uhid_no}</span>
                              )}
                              {(patient.age || patient.sex) && (
                                <span>
                                  · {[patient.age ? `${patient.age}y` : null, patient.sex].filter(Boolean).join(' / ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Admission / Stay */}
                        <td className="px-4 py-3.5 text-slate-600">
                          {patient.date_of_admission || patient.date_of_discharge ? (
                            <div className="text-[11px] flex items-center gap-1">
                              <span>{patient.date_of_admission || '—'}</span>
                              <span className="text-slate-400">&rarr;</span>
                              <span>{patient.date_of_discharge || '—'}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 3. Pipeline Format */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                              isCustom
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {isCustom ? 'Custom Template' : 'Standard'}
                          </span>
                        </td>

                        {/* 4. Pages */}
                        <td className="px-4 py-3.5 text-center font-mono font-medium text-slate-700">
                          {pagesCount !== '—' ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                              {pagesCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 5. Processing Time */}
                        <td className="px-4 py-3.5">
                          {durationSec != null ? (
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {durationSec.toFixed(1)}s
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 6. Tokens */}
                        <td className="px-4 py-3.5">
                          {totalTokens != null ? (
                            <div
                              className="group relative inline-block cursor-help font-mono text-xs"
                              title={`Input: ${promptTokens ?? 0} | Output: ${visibleTokens ?? 0} | Reasoning: ${thoughtTokens ?? 0}`}
                            >
                              <span className="font-semibold text-slate-800">
                                {formatTokensCompact(totalTokens)}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {thoughtTokens ? `${formatTokensCompact(thoughtTokens)} rsn · ` : ''}
                                {formatTokensCompact(visibleTokens ?? 0)} out
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 7. AI Cost */}
                        <td className="px-4 py-3.5">
                          {costInr != null ? (
                            <div>
                              <div className="font-semibold text-clinical-700 font-mono text-xs">
                                {formatCostInr(costInr)}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {formatCostUsd(costUsd)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 8. Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Inspect Telemetry */}
                            <button
                              type="button"
                              onClick={() => handleOpenTelemetry(patient)}
                              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                              title="Inspect AI processing and token telemetry"
                            >
                              Telemetry
                            </button>

                            {/* Open Document Editor */}
                            {patient.has_summary !== false && (
                              <Link
                                to={editSummaryPath(patient.user_id || userId, patient.patient_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex cursor-pointer items-center rounded-md bg-clinical-50 border border-clinical-200 px-2.5 py-1 text-xs font-medium text-clinical-700 hover:bg-clinical-100 transition-colors"
                                title="Open in Word editor"
                              >
                                Edit
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Slide-out / Inspection Modal */}
      <TelemetryModal
        patient={selectedPatient}
        metrics={selectedPatient ? metricsMap[selectedPatient.patient_id] : null}
        userId={userId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedPatient(null)
        }}
      />

      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        userId={userId}
        currentTemplate={doctorTemplate}
        onTemplateSaved={(savedTpl) => {
          setDoctorTemplate(savedTpl)
        }}
      />
    </div>
  )
}
