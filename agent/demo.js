/**
 * AgentPay — Autonomous Agent Demo
 * Full ERC-8183 job lifecycle on Arc Testnet
 * Usage: node agent/demo.js
 */

const BASE_URL = process.env.API_BASE_URL || 'https://agentpay-production-7a2a.up.railway.app'

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
  console.log(`🌐 API: ${BASE_URL}\n`)

  let passed = 0, failed = 0

  // Step 1: Create ERC-8183 Job
  console.log('🔷 Step 1: Creating ERC-8183 job on Arc Testnet...')
  const job = await post('/api/job/create', { description: 'Agent requesting DeFi signals for BTC' })
  if (!job.success) {
    console.log(`   ⚠️  ${job.message}\n`)
  } else {
    passed++
    console.log(`   ✅ Job ID: ${job.jobId?.slice(0, 30)}...`)
    console.log(`   💰 State: ${job.state}`)
    console.log(`   🔗 Contract: ${job.contractAddress}\n`)
  }

  // Step 2: Payment Required check
  console.log('🔷 Step 2: Testing middleware (no job ID)...')
  const noAuth = await get('/api/defi/signals?coin=bitcoin')
  if (noAuth.error === 'Payment Required') {
    passed++
    console.log('   ✅ 402 Payment Required — middleware working\n')
  } else { failed++; console.log('   ❌ Unexpected:', noAuth.error, '\n') }

  // Step 3: Fake job ID
  console.log('🔷 Step 3: Testing ERC-8183 validation (fake job ID)...')
  const fakeAuth = await get('/api/defi/signals?coin=bitcoin', 'fake-id')
  if (fakeAuth.error === 'Job Not Found') {
    passed++
    console.log('   ✅ Job Not Found — ERC-8183 validation working\n')
  } else { failed++; console.log('   ❌ Unexpected:', fakeAuth.error, '\n') }

  if (job.jobId) {
    // Step 4: DeFi Signals
    console.log('🔷 Step 4: /api/defi/signals (BTC)...')
    const signals = await get('/api/defi/signals?coin=bitcoin', job.jobId)
    if (signals.success) {
      passed++
      console.log(`   ✅ BTC: $${signals.data.price.usd.toLocaleString()} | Signal: ${signals.data.signal.action} (${signals.data.signal.confidence})\n`)
    } else { failed++; console.log('   ❌', signals.error, '\n') }

    // Step 5: Macro
    console.log('🔷 Step 5: /api/data/macro...')
    const j2 = await post('/api/job/create', { description: 'macro' })
    const macro = await get('/api/data/macro', j2.jobId)
    if (macro.success) {
      passed++
      console.log(`   ✅ BTC: $${macro.data.markets.bitcoin?.price?.toLocaleString()} | Risk: ${macro.data.riskSentiment}\n`)
    } else { failed++; console.log('   ❌', macro.error, '\n') }

    // Step 6: On-chain Analytics
    console.log('🔷 Step 6: /api/onchain/analytics...')
    const j3 = await post('/api/job/create', { description: 'analytics' })
    const analytics = await get('/api/onchain/analytics', j3.jobId)
    if (analytics.success) {
      passed++
      console.log(`   ✅ Balance: ${analytics.data.balance?.arc} ARC | Txs: ${analytics.data.transactionCount}\n`)
    } else { failed++; console.log('   ❌', analytics.error, '\n') }

    // Step 7: USDC
    console.log('🔷 Step 7: /api/data/usdc...')
    const j4 = await post('/api/job/create', { description: 'usdc' })
    const usdc = await get('/api/data/usdc', j4.jobId)
    if (usdc.success) {
      passed++
      console.log(`   ✅ USDC: $${usdc.data.price?.usd} | Peg: ${usdc.data.pegStatus}\n`)
    } else { failed++; console.log('   ❌', usdc.error, '\n') }

    // Step 8: AI Summarize
    console.log('🔷 Step 8: /api/ai/summarize...')
    const j5 = await post('/api/job/create', { description: 'ai' })
    const aiRes = await fetch(`${BASE_URL}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Job-Id': j5.jobId },
      body: JSON.stringify({ text: 'Bitcoin bullish momentum with strong volume. ERC-8183 enables trustless agent payments on Arc.' }),
    })
    const ai = await aiRes.json()
    if (ai.success) {
      passed++
      console.log(`   ✅ Sentiment: ${ai.data.sentiment} | Phrases: ${ai.data.keyPhrases?.slice(0,3).join(', ')}\n`)
    } else { failed++; console.log('   ❌', ai.error, '\n') }
  }

  // Dashboard
  console.log('🔷 Dashboard stats...')
  const dash = await get('/api/dashboard')
  if (dash.totalRequests !== undefined) {
    passed++
    console.log(`   ✅ Requests: ${dash.totalRequests} | Earned: ${dash.totalEarnedUsdc} USDC | Balance: ${dash.walletBalance}\n`)
  }

  console.log('╔══════════════════════════════════════════════════╗')
  console.log(`║  Results: ${passed} passed, ${failed} failed                        ║`)
  console.log('║  ERC-8183 Contract: 0x0747EEf...4583            ║')
  console.log('║  Network: Arc Testnet (Chain ID 5042002)            ║')
  console.log('╚══════════════════════════════════════════════════╝\n')
}

runAgentDemo().catch(console.error)
