import { useState } from 'react'
import { Link } from 'react-router-dom'
import { saveDoctorAuth } from '../config.js'

export default function DoctorAuthCard({
  title = 'Doctor Profile Setup',
  description = 'Enter your mobile and a 4-digit PIN. Data remains private.',
  buttonText = 'Access Discharges →',
  showBackHome = false,
  onAuthSuccess,
}) {
  const [phoneInput, setPhoneInput] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [authError, setAuthError] = useState('')

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
    onAuthSuccess?.(id)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full">
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
      </div>
    </div>
  )
}
