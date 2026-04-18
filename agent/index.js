/**
 * AgentPay — Simulated AI Agent
 *
 * Calls the AgentPay server's HTTP API for all payment operations.
 * The server holds Circle credentials — the agent only needs AGENT_WALLET_ID
 * and the server URL.
 *
 * Full cycle per request:
 *   1. POST /api/pay/transfer   → server creates Circle transfer, returns transferId
 *   2. Poll GET /api/pay/status/:id  until state === COMPLETE
 *   3. GET /api/weather  [X-Payment-Id: <transferId>]  → receive data
 */

require('dotenv').config()
const https = require('https')
const http = require('http')
const { URL } = require('url')

const BASE_URL = process.env.AGENT_API_URL || 'http://localhost:3000'
const AGENT_WALLET_ID = process.env.AGENT_WALLET_ID
const AGENT_WALLET_ADDRESS = process.env.AGENT_WALLET_ADDRESS
const INTERVAL_MS = parseInt(process.env.AGENT_INTERVAL_MS || '8000')
const CITIES = ['new-york', 'london', 'tokyo', 'sydney']

let requestCount = 0

// ─── Minimal HTTP client (no extra deps) ──────────────────────────────────────

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const isHttps = url.protocol === 'https:'
    const lib = isHttps ? https : http

    const reqHeaders = { 'Content-Type': 'application/json', ...headers }
    const bodyStr = body ? JSON.stringify(body) : null
    if (bodyStr) reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      }
    )
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomCity() {
  return CITIES[Math.floor(Math.random() * CITIES.length)]
}

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] [Agent] ${msg}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Poll transfer status via server ──────────────────────────────────────────

async function waitForTransfer(transferId, { maxAttempts = 60, intervalMs = 3000 } = {}) {
  const terminal = new Set(['COMPLETE', 'FAILED', 'CANCELLED'])

  for (let i = 0; i < maxAttempts; i++) {
    const res = await request('GET', `/api/pay/status/${transferId}`)

    if (res.status !== 200) {
      throw new Error(`Status check failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`)
    }

    const { state, txHash } = res.body
    log(`  Transfer ${transferId.slice(0, 8)}… → ${state}`)

    if (terminal.has(state)) return { state, txHash }
    await sleep(intervalMs)
  }

  throw new Error(`Transfer ${transferId} did not reach terminal state within timeout`)
}

// ─── Single request cycle ─────────────────────────────────────────────────────

async function payAndFetch() {
  requestCount++
  const city = randomCity()
  log(`─── Request #${requestCount} (city: ${city}) ───`)

  // Step 1: Ask the server to create a Circle transfer from the agent wallet
  log('Initiating 0.001 USDC payment...')
  const transferRes = await request('POST', '/api/pay/transfer', {
    fromWalletId: AGENT_WALLET_ID,
    fromWalletAddress: AGENT_WALLET_ADDRESS,
  })

  if (transferRes.status !== 200 || !transferRes.body.success) {
    log(`ERROR initiating transfer (HTTP ${transferRes.status}): ${JSON.stringify(transferRes.body)}`)
    return
  }

  const { transferId, state: initState } = transferRes.body
  log(`Transfer created: ${transferId} (state: ${initState})`)

  // Step 2: Poll until the transfer is COMPLETE
  log('Waiting for Circle to confirm...')
  let confirmed
  try {
    confirmed = await waitForTransfer(transferId)
  } catch (err) {
    log(`ERROR waiting for transfer: ${err.message}`)
    return
  }

  if (confirmed.state !== 'COMPLETE') {
    log(`Transfer ended in state ${confirmed.state} — aborting request`)
    return
  }
  log(`Transfer COMPLETE — txHash: ${confirmed.txHash || 'n/a'}`)

  // Step 3: Call the weather API using the transfer ID as proof of payment
  log(`Calling /api/weather?city=${city}...`)
  const weatherRes = await request('GET', `/api/weather?city=${city}`, null, {
    'X-Payment-Id': transferId,
  })

  if (weatherRes.status !== 200) {
    log(`ERROR calling weather API (HTTP ${weatherRes.status}): ${JSON.stringify(weatherRes.body)}`)
    return
  }

  const { data } = weatherRes.body
  log(`${data.icon}  ${data.city}: ${Number(data.temperature.celsius).toFixed(1)}°C, ${data.condition}`)
  log(`Paid 0.001 USDC for this response.\n`)
}

// ─── Main loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== AgentPay Simulated AI Agent ===')
  console.log(`Server:        ${BASE_URL}`)
  console.log(`Agent wallet:  ${AGENT_WALLET_ID || '(not set — add AGENT_WALLET_ID to .env)'}`)
  console.log(`Agent address: ${AGENT_WALLET_ADDRESS || '(not set — add AGENT_WALLET_ADDRESS to .env)'}`)
  console.log(`Interval:      ${INTERVAL_MS / 1000}s\n`)

  if (!AGENT_WALLET_ID) {
    console.error('ERROR: AGENT_WALLET_ID not set in .env')
    process.exit(1)
  }
  if (!AGENT_WALLET_ADDRESS) {
    console.error('ERROR: AGENT_WALLET_ADDRESS not set in .env')
    process.exit(1)
  }

  await payAndFetch()
  setInterval(payAndFetch, INTERVAL_MS)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
