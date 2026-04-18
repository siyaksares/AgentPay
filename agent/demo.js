/**
 * AgentPay — Autonomous Agent Demo
 * Full ERC-8183 job lifecycle: create → fund → call API → complete
 *
 * Usage: node agent/demo.js
 */

require('dotenv').config()
const BASE_URL = process.env.API_BASE_URL || 'https://agentpay-production-7a2a.up.railway.app'

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function post(path, body = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function get(path, jobId) {
  const headers = jobId ? { 'X-Job-Id': jobId } : {}
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  return res.json()
}

async function runAgentDemo() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     AgentPay — Autonomous Agent Demo             ║')
  console.log('║     ERC-8183 Job Lifecycle on Arc Testnet        ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // ── Step 1: Create ERC-8183 Job ──────────────────────────────────
  console.log('🔷 Step 1: Creating ERC-8183 job on Arc Testnet...')
  const job = await post('/api/job/create', {
    description: 'Agent requesting DeFi signals for BTC portfolio rebalancing',
  })

  if (!job.success) {
    console.error('❌ Job creation failed:', job.message)
    process.exit(1)
  }

  console.log(`   ✅ Job created!`)
  console.log(`   📋 Job ID:  ${job.jobId}`)
  console.log(`   💰 State:   ${job.state}`)
  console.log(`   🔗 Contract: ${job.contractAddress}`)
  console.log(`   🌐 Explorer: ${job.arcScanUrl}\n`)

  // ── Step 2: Poll job status ───────────────────────────────────────
  console.log('🔷 Step 2: Polling job status...')
  const status = await get(`/api/job/status/${job.jobId}`)
  console.log(`   ✅ State: ${status.job?.state}\n`)

  // ── Step 3: Call gated APIs with Job ID ──────────────────────────
  console.log('🔷 Step 3: Calling gated APIs with X-Job-Id header...\n')

  // 3a. DeFi Signals
  console.log('   📈 Fetching DeFi signals for Bitcoin...')
  const job2 = await post('/api/job/create', { description: 'DeFi signal request - BTC' })
  const signals = await get('/api/defi/signals?coin=bitcoin', job2.jobId)
  if (signals.success) {
    console.log(`   ✅ BTC Price:  $${signals.data.price.usd.toLocaleString()}`)
    console.log(`   ✅ 24h Change: ${signals.data.changes.h24.toFixed(2)}%`)
    console.log(`   ✅ Signal:     ${signals.data.signal.action} (${signals.data.signal.confidence} confidence)`)
    console.log(`   🔗 Job:        ${signals.job?.id?.slice(0, 20)}...\n`)
  }

  // 3b. Macro Data
  console.log('   🌍 Fetching macro market data...')
  const job3 = await post('/api/job/create', { description: 'Macro data request' })
  const macro = await get('/api/data/macro', job3.jobId)
  if (macro.success) {
    console.log(`   ✅ BTC:        $${macro.data.markets.bitcoin?.price?.toLocaleString()}`)
    console.log(`   ✅ ETH:        $${macro.data.markets.ethereum?.price?.toLocaleString()}`)
    console.log(`   ✅ Risk:       ${macro.data.riskSentiment}\n`)
  }

  // 3c. On-chain Analytics
  console.log('   🔍 Fetching Arc on-chain analytics...')
  const job4 = await post('/api/job/create', { description: 'On-chain analytics request' })
  const analytics = await get('/api/onchain/analytics', job4.jobId)
  if (analytics.success) {
    console.log(`   ✅ Address:    ${analytics.data.address?.slice(0, 20)}...`)
    console.log(`   ✅ Balance:    ${analytics.data.balance?.arc} ARC`)
    console.log(`   ✅ Tx Count:   ${analytics.data.transactionCount}`)
    console.log(`   🔗 Explorer:   ${analytics.data.blockExplorer}\n`)
  }

  // 3d. USDC Analytics
  console.log('   💵 Fetching USDC peg analytics...')
  const job5 = await post('/api/job/create', { description: 'USDC peg analytics' })
  const usdc = await get('/api/data/usdc', job5.jobId)
  if (usdc.success) {
    console.log(`   ✅ USDC Price: $${usdc.data.price?.usd}`)
    console.log(`   ✅ Peg Status: ${usdc.data.pegStatus}`)
    console.log(`   ✅ Deviation:  ${usdc.data.pegDeviation}\n`)
  }

  // 3e. AI Summarize
  console.log('   🤖 Running AI summarizer...')
  const job6 = await post('/api/job/create', { description: 'AI summarize request' })
  const aiRes = await fetch(`${BASE_URL}/api/ai/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Job-Id': job6.jobId },
    body: JSON.stringify({ text: 'Bitcoin is showing bullish momentum with strong volume and positive market sentiment. The ERC-8183 standard enables trustless agent payments on Arc Testnet.' }),
  })
  const ai = await aiRes.json()
  if (ai.success) {
    console.log(`   ✅ Sentiment:  ${ai.data.sentiment}`)
    console.log(`   ✅ Key Phrases: ${ai.data.keyPhrases?.slice(0, 3).join(', ')}\n`)
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  ✅ Agent Demo Complete!                         ║')
  console.log('║                                                  ║')
  console.log('║  6 ERC-8183 jobs created on Arc Testnet          ║')
  console.log('║  6 x 0.000001 USDC = 0.000006 USDC spent        ║')
  console.log('║  5 API endpoints called — all paid trustlessly   ║')
  console.log('║                                                  ║')
  console.log(`║  Contract: 0x0747EEf...4583                      ║`)
  console.log('╚══════════════════════════════════════════════════╝\n')
}

runAgentDemo().catch(console.error)
