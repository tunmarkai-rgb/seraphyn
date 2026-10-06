import { useEffect, useState } from 'react'
import { publicApiRequest } from './api'

// The marketplace's published pricing model:
//   nurse's desired pay + Seraphyn fee = hospital bill rate
// The fee amount is set by admin (/admin/settings) and served by GET /api/pricing.

export const DEFAULT_AGENCY_FEE = 17

let cached = null
let inflight = null

export function loadPricing() {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = publicApiRequest('/api/pricing')
      .then((data) => {
        cached = { agency_fee: Number(data?.agency_fee) || DEFAULT_AGENCY_FEE, ...data }
        return cached
      })
      .catch(() => ({ agency_fee: DEFAULT_AGENCY_FEE }))
      .finally(() => { inflight = null })
  }
  return inflight
}

// Forget the cached fee, e.g. right after admin changes it.
export function resetPricing() {
  cached = null
}

export function usePricing() {
  const [pricing, setPricing] = useState(cached || { agency_fee: DEFAULT_AGENCY_FEE })
  useEffect(() => {
    let alive = true
    loadPricing().then((data) => { if (alive) setPricing(data) })
    return () => { alive = false }
  }, [])
  return pricing
}

export function billRateFor(nursePay, fee) {
  const pay = Number(nursePay)
  if (nursePay === null || nursePay === undefined || nursePay === '' || !Number.isFinite(pay) || pay <= 0) return null
  return Math.round((pay + Number(fee)) * 100) / 100
}
