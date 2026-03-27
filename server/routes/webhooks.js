const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// POST /api/webhooks/stripe
// Raw body needed for Stripe signature verification — mount BEFORE express.json()
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        await supabase.from('payments')
          .update({ status: 'succeeded', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        await supabase.from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', pi.id)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { data: ep } = await supabase
          .from('employer_profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single()
        if (ep) {
          await supabase.from('employer_profiles').update({
            subscription_status: sub.status,
            subscription_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
            subscription_ends: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            updated_at: new Date().toISOString()
          }).eq('id', ep.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { data: ep } = await supabase
          .from('employer_profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single()
        if (ep) {
          await supabase.from('employer_profiles').update({
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString()
          }).eq('id', ep.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        await supabase.from('payments').insert({
          type: 'subscription',
          amount: invoice.amount_due,
          currency: invoice.currency,
          stripe_invoice_id: invoice.id,
          status: 'failed',
          notes: 'Invoice payment failed',
          created_at: new Date().toISOString()
        })
        break
      }

      default:
        // Unhandled event type — not an error
        break
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// POST /api/webhooks/docuseal — DocuSeal fires this when employer signs contract
router.post('/docuseal', async (req, res) => {
  const { event, submission } = req.body

  if (event !== 'submission.completed') return res.json({ received: true })

  try {
    const employerProfileId = submission?.metadata?.employer_profile_id
    const signedUrl = submission?.audit_log_url || submission?.documents?.[0]?.url

    if (employerProfileId) {
      await supabase.from('employer_profiles').update({
        contract_signed: true,
        contract_signed_at: new Date().toISOString(),
        onboarding_stage: 2,
        updated_at: new Date().toISOString()
      }).eq('id', employerProfileId)

      // Update contracts table if record exists
      if (signedUrl) {
        await supabase.from('contracts')
          .update({ status: 'signed', signed_at: new Date().toISOString(), signed_url: signedUrl })
          .eq('employer_id', employerProfileId)
          .eq('status', 'sent')
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('DocuSeal webhook error:', err)
    res.status(500).json({ error: 'Failed to process DocuSeal webhook' })
  }
})

// POST /api/webhooks/ghl — GoHighLevel webhook (Contract 2)
router.post('/ghl', async (req, res) => {
  // Placeholder for GHL integration (Contract 2)
  console.log('GHL webhook received:', req.body)
  res.json({ received: true })
})

module.exports = router
