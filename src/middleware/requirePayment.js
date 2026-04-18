const { jobs } = require('../routes/jobs')
const { isPaymentUsed, markPaymentUsed, recordTransaction } = require('../store')

async function requirePayment(req, res, next) {
  const jobId = req.headers['x-job-id']

  if (!jobId) {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'Include a valid ERC-8183 job ID in the X-Job-Id header.',
      hint: 'POST /api/job/create to create a funded job, then use the jobId here.',
    })
  }

  if (isPaymentUsed(jobId)) {
    return res.status(402).json({
      error: 'Job Already Settled',
      message: `Job ${jobId} has already been used for an API request.`,
    })
  }

  const job = jobs.get(jobId)
  if (!job) {
    return res.status(402).json({
      error: 'Job Not Found',
      message: `No ERC-8183 job found with ID ${jobId}. Create one via POST /api/job/create.`,
    })
  }

  if (job.state !== 'FUNDED' && job.state !== 'ACCEPTED') {
    return res.status(402).json({
      error: 'Job Not Funded',
      message: `Job state is ${job.state}. Job must be FUNDED before use.`,
      arcScanUrl: job.arcScanUrl,
    })
  }

  // Mark as used (replay protection)
  markPaymentUsed(jobId)

  // Attach job info to request
  req.job = job
  req.payment = {
    paymentId: jobId,
    txHash: job.txHash,
    fromAddress: job.providerAddress || process.env.API_WALLET_ADDRESS,
    amount: '0.000001',
  }

  recordTransaction({
    paymentId: jobId,
    txHash: job.txHash,
    fromAddress: req.payment.fromAddress,
    amount: '0.000001',
    endpoint: req.path,
  })

  // Mark job as COMPLETED after delivery
  job.state = 'COMPLETED'
  job.completedAt = new Date().toISOString()
  jobs.set(jobId, job)

  next()
}

module.exports = requirePayment
