const express = require('express')
const router = express.Router()
const requirePayment = require('../middleware/requirePayment')

// Exchange rates (CoinGecko free API kullanıyoruz)
// GET /api/exchange?from=usdc&to=usd
router.get('/', requirePayment, async (req, res) => {
  const from = (req.query.from || 'usd-coin').toLowerCase()
  const to = (req.query.to || 'usd').toLowerCase()

  try {
    const fetch = require('node-fetch')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${from}&vs_currencies=${to}`
    const response = await fetch(url)
    const data = await response.json()

    const rate = data[from]?.[to]

    if (rate === undefined) {
      return res.status(404).json({ success: false, error: 'Pair not found' })
    }

    res.json({
      success: true,
      data: {
        from,
        to,
        rate,
        timestamp: new Date().toISOString()
      },
      payment: {
        id: req.payment.paymentId,
        amount: `${req.payment.amount} USDC`,
        from: req.payment.fromAddress
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
