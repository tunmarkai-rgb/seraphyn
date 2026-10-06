const express = require('express')
const router = express.Router()
const { getBillingSettings, resolveAgencyFee } = require('../lib/rates')

// GET /api/pricing -- public. The Seraphyn fee is part of the marketplace's
// published model (desired pay + fee = hospital bill rate), so anyone may read
// it. The nurse pay bounds come along so the profile form can validate early.
router.get('/', async (req, res) => {
  try {
    const settings = await getBillingSettings()
    res.json({
      agency_fee: resolveAgencyFee(settings),
      min_nurse_rate: Number(settings.min_nurse_rate),
      max_nurse_rate: Number(settings.max_nurse_rate)
    })
  } catch (error) {
    console.error('Pricing read failed:', error.message)
    res.status(500).json({ error: 'Pricing is unavailable' })
  }
})

module.exports = router
