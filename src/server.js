require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const config = require('./config')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/weather', require('./routes/weather'))
app.use('/api/pay', require('./routes/payment'))
app.use('/api/crypto', require('./routes/exchange'))
app.use('/api/exchange', require('./routes/exchange'))

// ERC-8183 Job lifecycle
const { router: jobRouter } = require('./routes/jobs')
app.use('/api/job', jobRouter)

// New high-value data APIs
const dataRouter = require('./routes/data')
app.use('/api/onchain', dataRouter)
app.use('/api/defi', dataRouter)
app.use('/api/ai', dataRouter)
app.use('/api/data', dataRouter)

// Dashboard stats
app.use('/api/dashboard', require('./routes/dashboard'))

// ─── Catch-all → index.html ──────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`\nAgentPay server running on http://localhost:${config.port}`)
    console.log(`Dashboard: http://localhost:${config.port}`)
    console.log(`ERC-8183 Contract: 0x0747EEf0706327138c69792bF28Cd525089e4583`)
    console.log(`Arc Testnet: ${config.circle.blockchain}`)
    console.log(`API Wallet: ${config.wallet.apiWalletAddress || '(not configured)'}`)
    console.log(`Payment: ${config.payment.amountUsdc} USDC per request\n`)
    console.log('Available endpoints:')
    console.log('  POST /api/job/create          - Create ERC-8183 job')
    console.log('  GET  /api/job/status/:id       - Job lifecycle status')
    console.log('  GET  /api/weather              - Weather data')
    console.log('  GET  /api/onchain/analytics    - Arc on-chain analytics')
    console.log('  GET  /api/defi/signals         - DeFi trading signals')
    console.log('  POST /api/ai/summarize         - AI text summarizer')
    console.log('  GET  /api/data/macro           - Macro market data')
    console.log('  GET  /api/data/usdc            - USDC peg analytics\n')
  })
}

module.exports = app

// Auto-seed transactions on startup
async function seedTransactions() {
  try {
    const { recordTransaction } = require('./store')
    const endpoints = ['/signals', '/macro', '/analytics', '/usdc', '/summarize', '/weather', '/crypto']
    const wallet = process.env.API_WALLET_ADDRESS || '0xc321eefd3373bc52e9c21127c58e10c6bb374933'
    
    for (const ep of endpoints) {
      const fakeJobId = '0x' + require('crypto').randomBytes(32).toString('hex')
      recordTransaction({
        paymentId: fakeJobId,
        txHash: null,
        fromAddress: wallet,
        amount: '0.000001',
        endpoint: ep,
      })
    }
    console.log('✅ Seeded 7 demo transactions')
  } catch (e) {
    console.error('Seed error:', e.message)
  }
}

// Run seed after server starts
if (require.main === module) {
  setTimeout(seedTransactions, 2000)
}
