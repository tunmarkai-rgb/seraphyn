const express = require('express')
const router = express.Router()

const OFFLINE_MSG = { message: 'Payments are handled offline. Please contact your account manager.' }

router.post('/subscription', (req, res) => res.json(OFFLINE_MSG))
router.post('/placement-fee', (req, res) => res.json(OFFLINE_MSG))

module.exports = router
