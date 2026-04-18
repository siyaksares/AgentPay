require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const config = require('./config')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/weather', require('./routes/weather'))
app.use('/api/pay', require('./routes/payment'))
app.use('/api/dashboard', require('./routes/dashboard'))

// Serve dashboard for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`\nAgentPay server running on http://localhost:${config.port}`)
    console.log(`Dashboard: http://localhost:${config.port}`)
    console.log(`Weather API: http://localhost:${config.port}/api/weather`)
    console.log(`\nAPI Wallet: ${config.wallet.apiWalletAddress || '(not configured — run npm run setup)'}`)
    console.log(`Blockchain: ${config.circle.blockchain}`)
    console.log(`Payment: ${config.payment.amountUsdc} USDC per request\n`)
  })
}

module.exports = app
