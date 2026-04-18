const { verifyPayment } = require('../lib/circle')
const { isPaymentUsed, markPaymentUsed, recordTransaction } = require('../store')

// Middleware: requires a valid, unused Circle transfer ID in the X-Payment-Id header.
//
// Flow:
//   1. Extract X-Payment-Id from request headers
//   2. Check it hasn't been spent already (replay protection)
//   3. Verify with Circle API: COMPLETE state, correct destination, correct amount
//   4. Mark as used and record the transaction
//   5. Attach payment metadata to req.payment and call next()
async function requirePayment(req, res, next) {
  const paymentId = req.headers['x-payment-id']

  if (!paymentId) {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'Include a Circle transfer ID in the X-Payment-Id header.',
      hint: 'POST /api/pay/initiate to start a payment, then poll /api/pay/status/:id',
    })
  }

  if (isPaymentUsed(paymentId)) {
    return res.status(402).json({
      error: 'Payment Already Used',
      message: `Transfer ${paymentId} has already been used for an API request.`,
    })
  }

  let verification
  try {
    verification = await verifyPayment(paymentId)
  } catch (err) {
    return res.status(402).json({
      error: 'Payment Verification Failed',
      message: err.message,
    })
  }

  if (!verification.valid) {
    return res.status(402).json({
      error: 'Invalid Payment',
      message: verification.reason,
    })
  }

  // Atomically mark as used and record
  markPaymentUsed(paymentId)
  recordTransaction({
    paymentId,
    txHash: verification.txHash,
    fromAddress: verification.fromAddress,
    amount: verification.amount,
    endpoint: req.path,
  })

  req.payment = verification
  next()
}

module.exports = requirePayment
