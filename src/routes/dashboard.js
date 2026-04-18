const express = require('express')
const { getStats } = require('../store')
const { getWalletBalance } = require('../lib/circle')
const config = require('../config')

const router = express.Router()

// GET /api/dashboard
router.get('/', async (req, res) => {
  const stats = getStats()

  let walletBalance = null
  if (config.wallet.apiWalletId) {
    try {
      walletBalance = await getWalletBalance(config.wallet.apiWalletId)
    } catch {
      // Non-fatal: balance check may fail if not configured yet
    }
  }

  res.json({
    ...stats,
    pricePerRequest: `${config.payment.amountUsdc} USDC`,
    apiWalletAddress: config.wallet.apiWalletAddress || null,
    walletBalance: walletBalance ? `${walletBalance} USDC` : null,
    blockchain: config.circle.blockchain,
    serverTime: new Date().toISOString(),
  })
})

module.exports = router
