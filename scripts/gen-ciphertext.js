/**
 * Generates the Entity Secret Ciphertext needed by Circle Console Configurator.
 *
 * Two modes:
 *   1. Auto  — fetches Circle's public key via API (requires working CIRCLE_API_KEY)
 *   2. Manual — paste the public key directly as an argument (no API call needed)
 *
 * Usage:
 *   node scripts/gen-ciphertext.js
 *   node scripts/gen-ciphertext.js "-----BEGIN RSA PUBLIC KEY-----\n..."
 *
 * Where to find the public key manually:
 *   Circle Console → Developer Controlled Wallets → Configurator
 *   The page shows the RSA public key — copy the full PEM block.
 */

require('dotenv').config()
const https = require('https')
const crypto = require('crypto')

const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET
const API_KEY = process.env.CIRCLE_API_KEY
const PUBLIC_KEY_ARG = process.argv[2]

// ─── Validate entity secret ────────────────────────────────────────────────────

if (!ENTITY_SECRET || !/^[0-9a-f]{64}$/i.test(ENTITY_SECRET)) {
  console.error(
    'ERROR: CIRCLE_ENTITY_SECRET must be a 64-character hex string (32 bytes).\n' +
    'Generate one with:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  )
  process.exit(1)
}

// ─── Fetch public key from Circle API ─────────────────────────────────────────

function fetchPublicKey(apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api-sandbox.circle.com',
        path: '/v1/w3s/config/entity/publicKey',
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          if (res.statusCode === 401) {
            reject(new Error(
              `401 Invalid credentials.\n\n` +
              `Possible causes:\n` +
              `  • API key not yet activated for Programmable Wallets\n` +
              `  • Account hasn't enabled Developer-Controlled Wallets in Console\n` +
              `  • Wrong environment (key is prod, but hitting sandbox)\n\n` +
              `Fix: pass the public key directly instead (see usage at top of this file).\n` +
              `     Circle Console → Developer Controlled Wallets → Configurator\n` +
              `     Copy the RSA public key from that page, then run:\n\n` +
              `     node scripts/gen-ciphertext.js "$(pbpaste)"\n`
            ))
            return
          }
          try {
            resolve(JSON.parse(body).data.publicKey)
          } catch {
            reject(new Error(`Unexpected response (${res.statusCode}): ${body}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

// ─── Encrypt ───────────────────────────────────────────────────────────────────

function encrypt(entitySecretHex, publicKeyPem) {
  return crypto
    .publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(entitySecretHex, 'hex')
    )
    .toString('base64')
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let publicKey

  if (PUBLIC_KEY_ARG) {
    // Manual mode: public key passed as CLI argument
    publicKey = PUBLIC_KEY_ARG.replace(/\\n/g, '\n')
    console.log('Using provided public key.\n')
  } else {
    // Auto mode: fetch from Circle API
    if (!API_KEY) {
      console.error('ERROR: CIRCLE_API_KEY not set and no public key argument provided.')
      process.exit(1)
    }
    console.log('Fetching public key from Circle API...')
    publicKey = await fetchPublicKey(API_KEY)
    console.log('Public key fetched.\n')
  }

  const ciphertext = encrypt(ENTITY_SECRET, publicKey)

  console.log('─'.repeat(64))
  console.log('Entity Secret Ciphertext:')
  console.log('─'.repeat(64))
  console.log(ciphertext)
  console.log('─'.repeat(64))
  console.log()
  console.log('Paste this into:')
  console.log('  Circle Console → Developer Controlled Wallets → Configurator')
  console.log()
}

main().catch((err) => {
  console.error('\nFailed:', err.message)
  process.exit(1)
})
