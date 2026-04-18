const express = require('express')
const { getAddress } = require('viem')
const { initiateTransfer, getTransfer, getWalletBalance } = require('../lib/circle')
const config = require('../config')

// EIP-55 checksum the API wallet address once at startup.
// Circle rejects lowercase addresses on some chains with "Invalid destination address".
let apiWalletAddress
try {
  apiWalletAddress = getAddress(config.wallet.apiWalletAddress)
} catch {
  apiWalletAddress = config.wallet.apiWalletAddress
  if (apiWalletAddress) {
    console.warn(`[payment] API_WALLET_ADDRESS "${apiWalletAddress}" is not a valid EVM address`)
  }
}

const router = express.Router()

// POST /api/pay/initiate
// Returns the API wallet address and required amount for the caller to make a payment.
router.post('/initiate', async (req, res) => {
  try {
    res.json({
      success: true,
      apiWalletAddress: config.wallet.apiWalletAddress,
      amount: config.payment.amountUsdc,
      currency: 'USDC',
      blockchain: config.circle.blockchain,
      instructions: [
        `Send exactly ${config.payment.amountUsdc} USDC to ${config.wallet.apiWalletAddress}`,
        'Use the returned transferId as the X-Payment-Id header in your API request',
        'Poll GET /api/pay/status/:transferId until state is COMPLETE',
      ],
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/pay/transfer
// Initiates a transfer from a specified wallet (used by the agent).
// Body: { fromWalletId, fromWalletAddress }
router.post('/transfer', async (req, res) => {
  const { fromWalletId, fromWalletAddress } = req.body

  if (!fromWalletId) {
    return res.status(400).json({ error: 'fromWalletId is required' })
  }

  try {
    const transfer = await initiateTransfer({
      fromWalletId,
      fromWalletAddress,
      toAddress: apiWalletAddress,
      amountUsdc: config.payment.amountUsdc,
    })

    res.json({
      success: true,
      transferId: transfer.id,
      state: transfer.state,
      amount: config.payment.amountUsdc,
      currency: 'USDC',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/pay/status/:transferId
// Returns the current Circle transfer state.
router.get('/status/:transferId', async (req, res) => {
  try {
    const tx = await getTransfer(req.params.transferId)
    res.json({
      transferId: tx.id,
      state: tx.state,
      amount: tx.amounts?.[0],
      from: tx.sourceAddress,
      to: tx.destinationAddress,
      txHash: tx.txHash,
      createDate: tx.createDate,
      updateDate: tx.updateDate,
    })
  } catch (err) {
    res.status(404).json({ error: err.message })
  }
})

// GET /api/pay/balance/:walletId
// Check a wallet's USDC balance.
router.get('/balance/:walletId', async (req, res) => {
  try {
    const balance = await getWalletBalance(req.params.walletId)
    res.json({ walletId: req.params.walletId, usdcBalance: balance })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
