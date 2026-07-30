import { API_BASE_URL } from '../config.js'

export async function apiPostForm(path, form) {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = typeof data.detail === 'string'
      ? data.detail
      : Array.isArray(data.detail)
        ? data.detail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
        : `Request failed (${res.status})`
    throw new Error(detail)
  }
  return data
}
