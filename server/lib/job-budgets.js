// A hospital's budget for one job: target and maximum bill rate.
//
// Lives in its own table because `jobs` is readable by nurses and RLS is
// row-level, not column-level. Nurses only ever see a fit label derived from
// it (server/lib/matching.js). See docs/MARKETPLACE_PRICING.sql.

const { supabase } = require('../config/supabase')
const { normalizeUrgency } = require('./matching')

function parseRate(value, label) {
  if (value === null || value === undefined || value === '') return { value: null }
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0 || num > 1000) {
    return { error: `${label} must be an hourly amount between $1 and $1,000` }
  }
  return { value: Math.round(num * 100) / 100 }
}

// Validates { target_bill_rate, max_bill_rate } from a request body. Only the
// keys present in the body are returned, so a partial update leaves the other
// alone.
function readBudgetInput(body = {}) {
  const out = {}
  for (const [key, label] of [['target_bill_rate', 'Target bill rate'], ['max_bill_rate', 'Maximum bill rate']]) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue
    const parsed = parseRate(body[key], label)
    if (parsed.error) return { error: parsed.error }
    out[key] = parsed.value
  }
  if (out.target_bill_rate != null && out.max_bill_rate != null && out.target_bill_rate > out.max_bill_rate) {
    return { error: 'The target bill rate cannot be higher than the maximum' }
  }
  return { budget: out }
}

function readUrgencyInput(body = {}) {
  if (!Object.prototype.hasOwnProperty.call(body, 'urgency')) return undefined
  return normalizeUrgency(body.urgency)
}

async function saveBudget(jobId, budget) {
  if (!jobId || !budget || Object.keys(budget).length === 0) return null
  const { data, error } = await supabase
    .from('job_budgets')
    .upsert({ job_id: jobId, ...budget, updated_at: new Date().toISOString() }, { onConflict: 'job_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function loadBudgets(jobIds) {
  const ids = (jobIds || []).filter(Boolean)
  if (!ids.length) return new Map()
  const { data, error } = await supabase
    .from('job_budgets')
    .select('job_id, target_bill_rate, max_bill_rate')
    .in('job_id', ids)

  if (error) throw error
  return new Map((data || []).map((row) => [row.job_id, row]))
}

// Active jobs with their budgets attached, for matching. Server-side only.
async function loadActiveJobsWithBudgets() {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, employer_id, title, specialty, city, state, location, shift_type, contract_length, description, requirements, urgency, created_at, employer_profiles(org_name, city, state)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  const budgets = await loadBudgets((jobs || []).map((job) => job.id))
  return (jobs || []).map((job) => ({ ...job, budget: budgets.get(job.id) || null }))
}

// Removes the deprecated pay_rate before a job reaches a nurse or the public.
function publicJobShape(job) {
  if (!job) return job
  const { pay_rate, budget, ...rest } = job
  return rest
}

module.exports = {
  readBudgetInput,
  readUrgencyInput,
  saveBudget,
  loadBudgets,
  loadActiveJobsWithBudgets,
  publicJobShape
}
