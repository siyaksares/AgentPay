const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')
const { getAddress } = require('viem')
const { v4: uuidv4 } = require('uuid')
const config = require('../config')

// SDK handles RSA entity-secret encryption internally — no manual crypto needed.
// baseUrl must be set explicitly; the SDK default is production (api.circle.com).
const client = initiateDeveloperControlledWalletsClient({
  apiKey: config.circle.apiKey,
  entitySecret: config.circle.entitySecret,
  baseUrl: config.circle.baseUrl,
})

// ─── Error normalisation ───────────────────────────────────────────────────────

function wrapError(err) {
  // SDK throws typed errors (BadRequestError, etc.) — no .response property.
  // Real fields are: err.message, err.status (HTTP), err.code (Circle code), err.url
  const status = err.status ?? err.response?.status
  const msg = err.message ?? err.response?.data?.message ?? String(err)
  console.error('[circle] API error', status, `code=${err.code}`, `url=${err.url}`, msg)
  return Object.assign(new Error(`Circle API ${status}: ${msg}`), { status, original: err })
}

// ─── Token identifier ──────────────────────────────────────────────────────────

// When CIRCLE_USDC_TOKEN_ID is set, use tokenId + walletId (Circle resolves chain from wallet).
// Without tokenId, the API requires `blockchain` alongside `tokenAddress`, but `blockchain`
// is forbidden when using `walletId`. So fall back to walletAddress + blockchain instead.
function tokenFields() {
  if (config.circle.usdcTokenId) {
    return { tokenId: config.circle.usdcTokenId }
  }
  return { tokenAddress: config.arc.usdcAddress }
}

function walletSourceFields({ fromWalletId, fromWalletAddress }) {
  if (config.circle.usdcTokenId) {
    // tokenId path: walletId is sufficient, blockchain not needed
    return { walletId: fromWalletId }
  }
  // tokenAddress path: Circle requires blockchain, which is only allowed with walletAddress
  return { walletAddress: fromWalletAddress, blockchain: config.circle.blockchain }
}

// ─── Wallet Sets ───────────────────────────────────────────────────────────────

async function createWalletSet(name) {
  try {
    const res = await client.createWalletSet({ idempotencyKey: uuidv4(), name })
    return res.data.walletSet
  } catch (err) {
    throw wrapError(err)
  }
}

// ─── Wallets ───────────────────────────────────────────────────────────────────

async function createWallets(walletSetId, count = 1) {
  try {
    const res = await client.createWallets({
      idempotencyKey: uuidv4(),
      walletSetId,
      blockchains: [config.circle.blockchain],
      count,
    })
    return res.data.wallets
  } catch (err) {
    throw wrapError(err)
  }
}

async function getWalletBalance(walletId) {
  try {
    // SDK uses { id } not { walletId } for this method
    const res = await client.getWalletTokenBalance({ id: walletId })
    const balances = res.data?.tokenBalances ?? []
    const usdc = balances.find((b) => b.token?.symbol === 'USDC')
    return usdc ? usdc.amount : '0'
  } catch (err) {
    throw wrapError(err)
  }
}

// ─── Transfers ─────────────────────────────────────────────────────────────────

async function initiateTransfer({ fromWalletId, fromWalletAddress, toAddress, amountUsdc }) {
  const payload = {
    idempotencyKey: uuidv4(),
    ...walletSourceFields({ fromWalletId, fromWalletAddress }),
    destinationAddress: toAddress,
    amount: [amountUsdc],
    ...tokenFields(),
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  }

  console.log('[circle] createTransaction payload:', JSON.stringify(payload, null, 2))

  try {
    const res = await client.createTransaction(payload)
    // TrimDataResponse flattens the envelope: res.data = { id, state }
    console.log('[circle] createTransaction response:', JSON.stringify(res.data, null, 2))
    return res.data
  } catch (err) {
    throw wrapError(err)
  }
}

// States: INITIATED → PENDING → CONFIRMED → COMPLETE | FAILED | CANCELLED
async function getTransfer(transferId) {
  try {
    // SDK uses { id } object, returns response.data.transaction
    const res = await client.getTransaction({ id: transferId })
    return res.data.transaction
  } catch (err) {
    throw wrapError(err)
  }
}

async function waitForTransfer(transferId, { maxAttempts = 30, intervalMs = 2000 } = {}) {
  const terminal = new Set(['COMPLETE', 'FAILED', 'CANCELLED'])
  for (let i = 0; i < maxAttempts; i++) {
    const tx = await getTransfer(transferId)
    if (terminal.has(tx.state)) return tx
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Transfer ${transferId} did not reach terminal state within timeout`)
}

// ─── Payment verification ──────────────────────────────────────────────────────

async function verifyPayment(transferId) {
  const tx = await getTransfer(transferId)

  if (tx.state !== 'COMPLETE') {
    return { valid: false, reason: `Transfer state is ${tx.state}, expected COMPLETE` }
  }

  let apiWalletAddress, txDest
  try {
    apiWalletAddress = getAddress(config.wallet.apiWalletAddress)
    txDest = getAddress(tx.destinationAddress ?? '')
  } catch {
    apiWalletAddress = (config.wallet.apiWalletAddress ?? '').toLowerCase()
    txDest = (tx.destinationAddress ?? '').toLowerCase()
  }
  if (txDest !== apiWalletAddress) {
    return { valid: false, reason: 'Transfer destination does not match API wallet' }
  }

  const received = parseFloat(tx.amounts?.[0] ?? '0')
  const required = parseFloat(config.payment.amountUsdc)
  if (received < required) {
    return { valid: false, reason: `Insufficient: got ${received} USDC, need ${required}` }
  }

  return {
    valid: true,
    fromAddress: tx.sourceAddress,
    amount: tx.amounts?.[0] ?? config.payment.amountUsdc,
    txHash: tx.txHash,
  }
}

module.exports = {
  createWalletSet,
  createWallets,
  getWalletBalance,
  initiateTransfer,
  getTransfer,
  waitForTransfer,
  verifyPayment,
}
