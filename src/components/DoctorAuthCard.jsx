import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { TEMPLATE_FILE_ACCEPT, saveDoctorAuth } from '../config.js'
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
  saveDoctorTemplate,
} from '../utils/templateStorage.js'
import {
  saveUserTemplateToCloud,
  deleteUserTemplateFromCloud,
  saveDoctorMetadataToCloud,
} from '../api/dischargeApi.js'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DoctorAuthCard({
  title = 'Doctor Profile Setup',
  description = 'Enter your mobile and a 4-digit PIN. Data remains private.',
  buttonText = 'Continue →',
  showBackHome = false,
  onAuthSuccess,
}) {
  // Step 1: 'auth', Step 2: 'template'
  const [step, setStep] = useState('auth')
  const [activeDoctorId, setActiveDoctorId] = useState(null)

  // Auth form inputs
  const [phoneInput, setPhoneInput] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [authError, setAuthError] = useState('')

  // Template onboarding inputs
  const [templateMode, setTemplateMode] = useState('standard')
  const [templateFiles, setTemplateFiles] = useState([])
  const [templateError, setTemplateError] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const templateInputRef = useRef(null)

  const handleAuthSubmit = (e) => {
    e.preventDefault()
    const cleanPhone = phoneInput.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setAuthError('Enter a valid 10-digit mobile number.')
      return
    }
    if (pinInput.trim().length !== 4) {
      setAuthError('Enter a 4-digit PIN.')
      return
    }

    const id = saveDoctorAuth(cleanPhone, pinInput.trim())
    setAuthError('')
    setActiveDoctorId(id)

    // Persist phone and PIN across users/{user_id}/metadata.json
    saveDoctorMetadataToCloud(id, { phone: cleanPhone, pin: pinInput.trim() }).catch(() => {})

    // Check if this doctor has already configured their template
    if (hasCompletedOnboarding(id)) {
      onAuthSuccess?.(id)
    } else {
      // First-time doctor: show template setup
      setStep('template')
    }
  }

  const handleTemplateFilesChange = (e) => {
    const incoming = Array.from(e.target.files || [])
    if (!incoming.length) return
    setTemplateError('')

    for (const f of incoming) {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
      if (ext === '.doc') {
        setTemplateError('Legacy Word (.doc) is not supported. Please use .docx or .pdf.')
        return
      }
      if (f.size > 30 * 1024 * 1024) {
        setTemplateError(`File "${f.name}" exceeds 30 MB limit.`)
        return
      }
    }

    setTemplateFiles(incoming)
    setTemplateMode('custom')
  }

  const handleTemplateFinish = async (e) => {
    e.preventDefault()
    if (!activeDoctorId) return

    if (templateMode === 'custom' && templateFiles.length === 0) {
      setTemplateError('Please attach your hospital template document or choose Standard Format.')
      return
    }

    setSavingTemplate(true)
    setTemplateError('')

    try {
      if (templateMode === 'custom') {
        await saveDoctorTemplate(activeDoctorId, {
          mode: 'custom',
          files: templateFiles,
          filename: templateFiles[0]?.name || 'custom-template',
        })
        await saveUserTemplateToCloud(activeDoctorId, templateFiles)
      } else {
        await saveDoctorTemplate(activeDoctorId, {
          mode: 'standard',
          files: [],
          filename: '',
        })
        await deleteUserTemplateFromCloud(activeDoctorId)
      }

      markOnboardingCompleted(activeDoctorId)
      onAuthSuccess?.(activeDoctorId)
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Failed to save template')
      setSavingTemplate(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 max-w-lg w-full">
        {step === 'auth' ? (
          /* STEP 1: DOCTOR AUTHENTICATION */
          <>
            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              🩺
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">{title}</h2>
            <p className="text-sm text-slate-500 mb-6">{description}</p>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="auth-mobile-input"
                  className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider"
                >
                  Mobile Number
                </label>
                <input
                  id="auth-mobile-input"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="auth-pin-input"
                  className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider"
                >
                  4-Digit Secret PIN
                </label>
                <input
                  id="auth-pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 text-lg tracking-widest"
                />
              </div>
              {authError && <p className="text-xs text-red-500 font-medium">{authError}</p>}
              <button
                type="submit"
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold shadow-md transition cursor-pointer"
              >
                {buttonText}
              </button>
              {showBackHome && (
                <div className="text-center pt-2">
                  <Link
                    to="/"
                    className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    ← Return to Home
                  </Link>
                </div>
              )}
            </form>
          </>
        ) : (
          /* STEP 2: DISCHARGE TEMPLATE SETUP (FIRST-TIME ONBOARDING) */
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-xl font-bold">
                📋
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                  Step 2 of 2 · One-time Setup
                </span>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">
                  Discharge Summary Format
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              How would you like your discharge summaries generated? You can update this anytime from your account menu.
            </p>

            <form onSubmit={handleTemplateFinish} className="space-y-3.5">
              <input
                ref={templateInputRef}
                type="file"
                accept={TEMPLATE_FILE_ACCEPT}
                multiple
                className="hidden"
                onChange={handleTemplateFilesChange}
              />

              {/* Option A: Standard Format */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setTemplateMode('standard')
                  setTemplateError('')
                }}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTemplateMode('standard')}
                className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all ${
                  templateMode === 'standard'
                    ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">✨</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">
                          Default Format
                        </h4>
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
                          Ready immediately
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Start right away without a custom template. You can add one anytime from your account menu.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      templateMode === 'standard'
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {templateMode === 'standard' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                    )}
                  </span>
                </div>
              </div>

              {/* Option B: Upload Hospital Template */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setTemplateMode('custom')
                  setTemplateError('')
                }}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTemplateMode('custom')}
                className={`cursor-pointer rounded-xl border-2 p-3.5 transition-all ${
                  templateMode === 'custom'
                    ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📁</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Upload Hospital Template
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Attach your hospital's Word (.docx), PDF, or photos of your blank summary sheet.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      templateMode === 'custom'
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {templateMode === 'custom' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                    )}
                  </span>
                </div>

                {/* Sub-upload area if Custom is selected */}
                {templateMode === 'custom' && (
                  <div className="mt-3 pt-3 border-t border-teal-100/70">
                    {templateFiles.length === 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          templateInputRef.current?.click()
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Attach Template File</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between rounded-lg bg-white border border-teal-200 p-2 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-teal-700">✓</span>
                          <span className="font-medium text-slate-800 truncate">
                            {templateFiles[0]?.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({formatBytes(templateFiles[0]?.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            templateInputRef.current?.click()
                          }}
                          className="text-[11px] font-semibold text-teal-700 hover:underline shrink-0 ml-2"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {templateError && (
                <p className="text-xs text-red-500 font-medium">{templateError}</p>
              )}

              <button
                type="submit"
                disabled={savingTemplate}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold shadow-md transition cursor-pointer mt-2 disabled:opacity-50"
              >
                {savingTemplate ? 'Setting up…' : 'Start Creating Discharges →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
