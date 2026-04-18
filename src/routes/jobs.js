const express = require('express')
const router = express.Router()
const { createJob, completeJob } = require('../lib/erc8183')
const { recordTransaction } = require('../store')
const crypto = require('crypto')

// In-memory job store (replace with DB for production)
const jobs = new Map()

// POST /api/job/create
// Body: { description, providerAddress }
router.post('/create', async (req, res) => {
  try {
    const { description = 'AgentPay API Job', providerAddress } = req.body

    const result = await createJob({
      providerAddress,
      description,
      walletId: process.env.API_WALLET_ID,
    })

    jobs.set(result.jobId, {
      ...result,
      description,
      createdAt: new Date().toISOString(),
    })

    res.json({
      success: true,
      jobId: result.jobId,
      txHash: result.txHash,
      state: result.state,
      contractAddress: result.contractAddress,
      arcScanUrl: result.arcScanUrl,
      message: 'ERC-8183 job created and funded on Arc Testnet. Use jobId as X-Job-Id header.',
    })
  } catch (err) {
    console.error('createJob error:', err)
    res.status(500).json({ error: 'Job creation failed', message: err.message })
  }
})

// GET /api/job/status/:jobId
router.get('/status/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) {
    return res.status(404).json({ error: 'Job not found', jobId: req.params.jobId })
  }
  res.json({
    success: true,
    job: {
      jobId: job.jobId,
      state: job.state,
      txHash: job.txHash,
      arcScanUrl: job.arcScanUrl,
      description: job.description,
      createdAt: job.createdAt,
      completedAt: job.completedAt || null,
    },
  })
})

// POST /api/job/complete/:jobId  (internal — called after API delivery)
router.post('/complete/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = jobs.get(jobId)
    if (!job) return res.status(404).json({ error: 'Job not found' })

    const deliverableHash = '0x' + crypto.createHash('sha256')
      .update(JSON.stringify({ jobId, completedAt: new Date().toISOString() }))
      .digest('hex')

    const result = await completeJob({ jobId, deliverableHash })

    job.state = 'COMPLETED'
    job.completedAt = new Date().toISOString()
    job.completeTxHash = result.txHash
    jobs.set(jobId, job)

    recordTransaction({
      paymentId: jobId,
      txHash: result.txHash,
      fromAddress: process.env.API_WALLET_ADDRESS,
      amount: '0.000001',
      endpoint: '/api/job/complete',
    })

    res.json({
      success: true,
      jobId,
      state: 'COMPLETED',
      txHash: result.txHash,
      arcScanUrl: result.arcScanUrl,
    })
  } catch (err) {
    console.error('completeJob error:', err)
    res.status(500).json({ error: 'Job completion failed', message: err.message })
  }
})

// Export jobs map for middleware use
module.exports = { router, jobs }
