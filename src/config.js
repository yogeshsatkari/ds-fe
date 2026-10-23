export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://ds-x5ai.onrender.com'

export const FILE_ACCEPT = 'image/*,application/pdf,.pdf'
export const TEMPLATE_FILE_ACCEPT = '.docx,application/pdf,.pdf,image/*'
export const MAX_FILES = 30
export const MAX_TOTAL_SIZE_MB = 50

export const USD_TO_INR_RATE = Number(import.meta.env.VITE_USD_TO_INR_RATE ?? 98)

/**
 * Synchronous, zero-latency (0.05ms) deterministic UUID generator.
 * Pure CPU bitwise math — zero network requests.
 */
export function generateUserUuid(phone, pin) {
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10)
  const cleanPin = (pin || '').trim()
  const seed = `ds_v1_${cleanPhone}_${cleanPin}`
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57,
    h3 = 0x7b7d1429,
    h4 = 0x9e3779b9
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761) >>> 0
    h2 = Math.imul(h2 ^ ch, 1597334677) >>> 0
    h3 = Math.imul(h3 ^ ch, 3812015801) >>> 0
    h4 = Math.imul(h4 ^ ch, 2246822507) >>> 0
  }
  const toHex = (n) => n.toString(16).padStart(8, '0')
  const hex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function getStoredUserId() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('user_id') || null
}

export function getStoredDoctorPhone() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('doctor_phone') || ''
}

export function saveDoctorAuth(phone, pin) {
  const userId = generateUserUuid(phone, pin)
  if (typeof window !== 'undefined') {
    localStorage.setItem('user_id', userId)
    if (phone) {
      localStorage.setItem('doctor_phone', phone.replace(/\D/g, '').slice(-10))
    }
  }
  return userId
}

export function clearDoctorAuth() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user_id')
    localStorage.removeItem('doctor_phone')
  }
}

const allowedDashboardIdsList = (import.meta.env.VITE_DASHBOARD_ALLOWED_USER_IDS ?? '')
  .split(',')
  .map((id) => id.trim().toLowerCase())
  .filter(Boolean)

export const DASHBOARD_ALLOWED_USER_IDS = allowedDashboardIdsList

export function isDashboardAllowedUser(userId) {
  if (!userId) return false
  const cleanId = String(userId).trim().toLowerCase()
  return DASHBOARD_ALLOWED_USER_IDS.includes(cleanId)
}

