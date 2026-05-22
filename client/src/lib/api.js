import { supabase } from './supabase'

const apiBase = import.meta.env.VITE_API_URL || ''

export async function apiRequest(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = options.accessToken || session?.access_token

  if (!token) {
    throw new Error('You must be signed in to perform this action')
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...(options.body ? { body: isFormData ? options.body : JSON.stringify(options.body) } : {})
  })

  const text = await response.text()
  const data = text ? (() => {
    try {
      return JSON.parse(text)
    } catch {
      return { message: text }
    }
  })() : {}

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed')
  }

  return data
}

export async function publicApiRequest(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...(options.body ? { body: isFormData ? options.body : JSON.stringify(options.body) } : {})
  })

  const text = await response.text()
  const data = text ? (() => {
    try {
      return JSON.parse(text)
    } catch {
      return { message: text }
    }
  })() : {}

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed')
  }

  return data
}
