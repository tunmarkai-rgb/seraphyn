// Shared currency formatting. Before this existed every site did `$${v}/hr`
// inline, which renders "$78.5/hr" for 78.5.
//
// Duplicated in server/lib/rates.js for notification and email bodies. The two
// package roots have no shared workspace, so keep them in sync by hand.

export function formatHourly(value, { empty = 'Rate on request' } = {}) {
  if (value === null || value === undefined || value === '') return empty
  const amount = Number(value)
  if (!Number.isFinite(amount)) return empty

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount)

  return `${formatted}/hr`
}

export function formatCurrency(value, { empty = '—' } = {}) {
  if (value === null || value === undefined || value === '') return empty
  const amount = Number(value)
  if (!Number.isFinite(amount)) return empty

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount)
}
