const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { createJob, setBudget, fundJob, submitJob, completeJob, ERC_8183 } = require('../lib/erc8183')
const { recordTransaction } = require('../store')
const config = require('../config')

// In-memory job store (production'da DB olur)
const jobs = new Map()

// POST /api/job/create
// Agent yeni bir API job'ı oluşturur
router.post('/create', async (req, res) => {
  const { endpoint, description } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' })

  try {
    const jobDescription = description || `AgentPay API Job: ${endpoint}`
    
    const tx = await createJob({
      providerAddress: config.wallet.apiWalletAddress,
      description: jobDescription,
      budgetUsdc: config.payment.amountUsdc,
    })

    const jobId = Date.now().toString() // temp ID until onchain confirmed
    jobs.set(jobId, {
      jobId,
      endpoint,
      description: jobDescription,
      status: 'CREATED',
      txHash: tx?.txHash || null,
      createdAt: new Date().toISOString(),
    })

    res.json({
      success: true,
      jobId,
      endpoint,
      contract: ERC_8183,
      status: 'CREATED',
      txHash: tx?.txHash || null,
      next: `POST /api/job/${jobId}/fund`,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/job/:jobId/fund
// Agent USDC'yi escrow'a kilitler
router.post('/:jobId/fund', async (req, res) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  try {
    const tx = await fundJob({
      jobId,
      amountUsdc: config.payment.amountUsdc,
    })

    job.status = 'FUNDED'
    job.fundTxHash = tx?.txHash || null

    res.json({
      success: true,
      jobId,
      status: 'FUNDED',
      escrow: ERC_8183,
      txHash: tx?.txHash || null,
      next: `GET ${job.endpoint}?jobId=${jobId}`,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/job/:jobId/complete
// Server deliverable'ı onaylar, ödeme serbest kalır
router.post('/:jobId/complete', async (req, res) => {
  const { jobId } = req.params
  const { deliverable } = req.body
  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  try {
    // Hash deliverable onchain
    const deliverableHash = '0x' + crypto.createHash('sha256')
      .update(JSON.stringify(deliverable || job.endpoint))
      .digest('hex')

    const submitTx = await submitJob({ jobId, deliverableHash })
    const completeTx = await completeJob({ jobId })

    job.status = 'COMPLETED'
    job.deliverableHash = deliverableHash
    job.completeTxHash = completeTx?.txHash || null

    recordTransaction({
      paymentId: jobId,
      txHash: completeTx?.txHash || submitTx?.txHash || 'erc8183',
      fromAddress: config.wallet.agentWalletAddress,
      amount: config.payment.amountUsdc,
      endpoint: job.endpoint,
    })

    res.json({
      success: true,
      jobId,
      status: 'COMPLETED',
      deliverableHash,
      txHash: completeTx?.txHash || null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/job/:jobId
router.get('/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({ success: true, job })
})

module.exports = router
