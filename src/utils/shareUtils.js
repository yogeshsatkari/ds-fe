/**
 * Share & Clipboard Utilities for Discharge Summaries
 * - Mobile: opens native share sheet (WhatsApp, Telegram, etc.)
 * - Other screens (Desktop): quietly copies link to clipboard
 */

export function getShareUrl(userId, patientId) {
  if (typeof window === 'undefined') return `/edit/${userId}/${patientId}`
  return `${window.location.origin}/edit/${userId}/${patientId}`
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || '',
    ) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent || ''))
  )
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to execCommand fallback
    }
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    textArea.remove()
    return successful
  } catch (err) {
    console.error('Clipboard copy failed:', err)
    return false
  }
}

/**
 * Share discharge summary:
 * - Only on mobile: try native share (Web Share API for WhatsApp, Telegram, etc.)
 * - Other screens: just copy link to clipboard (button shows "Copied!" in-place, zero popup banners)
 */
export async function shareDischargeSummary({ userId, patientId, patientName }) {
  if (!userId || !patientId) return { success: false, method: 'invalid' }

  const url = getShareUrl(userId, patientId)
  const title = patientName ? `Discharge Summary - ${patientName}` : 'Discharge Summary'
  const text = patientName
    ? `Discharge summary for ${patientName}:`
    : 'Discharge summary:'

  // 1. Only on mobile: try native share
  if (isMobileDevice() && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return { success: true, method: 'native-share' }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'dismissed' }
      }
      // If mobile share fails, fall through to copy
    }
  }

  // 2. Other screens: just copy link
  const copied = await copyToClipboard(url)
  if (copied) {
    return { success: true, method: 'clipboard' }
  }

  return { success: false, method: 'error' }
}
