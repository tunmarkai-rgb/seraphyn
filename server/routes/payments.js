const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireApproved } = require('../middleware/auth')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// POST /api/payments/subscription — create or retrieve Stripe customer + subscription
router.post('/subscription', requireAuth, requireRole('employer'), requireApproved, async (req, res) => {
  try {
    const { data: ep } = await supabase
      .from('employer_profiles')
      .select('id, stripe_customer_id, org_name')
      .eq('user_id', req.user.id)
      .single()

    if (!ep) return res.status(404).json({ error: 'Employer profile not found' })

    let customerId = ep.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: ep.org_name,
        metadata: { employer_profile_id: ep.id, user_id: req.user.id }
      })
      customerId = customer.id
      await supabase.from('employer_profiles').update({ stripe_customer_id: customerId }).eq('id', ep.id)
    }

    // Create checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Seraphyn Platform Subscription', description: 'Monthly access to Seraphyn staffing platform' },
          unit_amount: 9900, // $99.00
          recurring: { interval: 'month', trial_period_days: 90 }
        },
        quantity: 1
      }],
      success_url: `${process.env.CLIENT_URL}/employer/dashboard?subscription=success`,
      cancel_url: `${process.env.CLIENT_URL}/employer/dashboard?subscription=cancelled`,
      metadata: { employer_profile_id: ep.id }
    })

    res.json({ checkout_url: session.url, session_id: session.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payments/placement-fee — charge employer placement fee after hire
router.post('/placement-fee', requireAuth, requireRole('admin'), async (req, res) => {
  const { application_id, placement_percentage } = req.body

  if (!application_id || !placement_percentage) {
    return res.status(400).json({ error: 'application_id and placement_percentage are required' })
  }

  try {
    const { data: app } = await supabase
      .from('applications')
      .select('*, jobs(title, pay_rate, contract_length), employer_profiles(stripe_customer_id, org_name, user_id)')
      .eq('id', application_id)
      .single()

    if (!app) return res.status(404).json({ error: 'Application not found' })
    if (app.status !== 'hired') return res.status(400).json({ error: 'Application must be in hired status' })

    const customerId = app.employer_profiles?.stripe_customer_id
    if (!customerId) return res.status(400).json({ error: 'Employer has no Stripe customer on file' })

    // Estimate fee: pay_rate * 40hr/wk * 13 weeks * placement_percentage / 100
    const estimatedAnnualSalary = (app.jobs?.pay_rate || 50) * 40 * 52
    const feeAmount = Math.round(estimatedAnnualSalary * (placement_percentage / 100) * 100) // in cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: feeAmount,
      currency: 'usd',
      customer: customerId,
      description: `Placement fee for ${app.jobs?.title} — ${placement_percentage}%`,
      metadata: { application_id, placement_percentage: String(placement_percentage) },
      confirm: false
    })

    // Record in DB
    await supabase.from('payments').insert({
      employer_id: app.employer_id,
      type: 'placement_fee',
      amount: feeAmount,
      currency: 'usd',
      stripe_payment_intent_id: paymentIntent.id,
      placement_percentage,
      job_id: app.job_id,
      application_id,
      status: 'pending'
    })

    await supabase.from('applications').update({ placement_fee_pct: placement_percentage }).eq('id', application_id)

    res.json({ payment_intent_id: paymentIntent.id, amount: feeAmount, client_secret: paymentIntent.client_secret })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
