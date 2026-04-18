// In-memory store. Replace with Redis/DB for production.

const usedPaymentIds = new Set()

const transactions = []

const stats = {
  totalRequests: 0,
  totalEarnedRaw: 0n,   // in USDC raw units (6 decimals)
  totalEarnedUsdc: '0',
}

function markPaymentUsed(paymentId) {
  usedPaymentIds.add(paymentId)
}

function isPaymentUsed(paymentId) {
  return usedPaymentIds.has(paymentId)
}

function recordTransaction({ paymentId, txHash, fromAddress, amount, endpoint }) {
  stats.totalRequests++
  stats.totalEarnedRaw += BigInt(Math.round(parseFloat(amount) * 1_000_000))
  stats.totalEarnedUsdc = (Number(stats.totalEarnedRaw) / 1_000_000).toFixed(6)

  transactions.unshift({
    paymentId,
    txHash: txHash || null,
    fromAddress,
    amount,
    endpoint,
    timestamp: new Date().toISOString(),
  })

  // Keep last 50 transactions
  if (transactions.length > 50) transactions.pop()
}

function getStats() {
  return {
    totalRequests: stats.totalRequests,
    totalEarnedUsdc: stats.totalEarnedUsdc,
    recentTransactions: transactions.slice(0, 10),
  }
}

module.exports = { markPaymentUsed, isPaymentUsed, recordTransaction, getStats }
