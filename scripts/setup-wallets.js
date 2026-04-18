/**
 * One-time setup: creates Circle wallet set + two wallets (API and Agent),
 * then prints the .env values to add.
 *
 * Run: npm run setup
 */

require('dotenv').config()
const { createWalletSet, createWallets, getWalletBalance } = require('../src/lib/circle')
const config = require('../src/config')

async function main() {
  console.log('\n=== AgentPay — Circle Wallet Setup ===\n')

  if (!config.circle.apiKey || config.circle.apiKey === 'TEST_API_KEY:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    console.error('ERROR: CIRCLE_API_KEY not set. Copy .env.example to .env and fill in your values.')
    process.exit(1)
  }

  if (!config.circle.entitySecret || config.circle.entitySecret.length < 64) {
    console.error(
      'ERROR: CIRCLE_ENTITY_SECRET must be a 32-byte hex string (64 hex chars).\n' +
      'Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
    process.exit(1)
  }

  // If wallets already exist, just print current balances
  if (config.wallet.apiWalletId && config.wallet.agentWalletId) {
    console.log('Wallets already configured. Checking balances...')
    const [apiBalance, agentBalance] = await Promise.all([
      getWalletBalance(config.wallet.apiWalletId),
      getWalletBalance(config.wallet.agentWalletId),
    ])
    console.log(`API wallet   (${config.wallet.apiWalletAddress}): ${apiBalance} USDC`)
    console.log(`Agent wallet (${config.wallet.agentWalletAddress}): ${agentBalance} USDC`)
    console.log('\nTo fund wallets visit: https://faucet.circle.com')
    return
  }

  console.log(`Creating wallet set on ${config.circle.blockchain}...`)
  const walletSet = await createWalletSet('AgentPay')
  console.log(`Wallet set created: ${walletSet.id}`)

  console.log('Creating API wallet and Agent wallet...')
  const wallets = await createWallets(walletSet.id, 2)
  const [apiWallet, agentWallet] = wallets

  console.log('\n✓ Wallets created successfully!\n')
  console.log('Add these to your .env file:\n')
  console.log('─'.repeat(50))
  console.log(`CIRCLE_WALLET_SET_ID=${walletSet.id}`)
  console.log(`API_WALLET_ID=${apiWallet.id}`)
  console.log(`API_WALLET_ADDRESS=${apiWallet.address}`)
  console.log(`AGENT_WALLET_ID=${agentWallet.id}`)
  console.log(`AGENT_WALLET_ADDRESS=${agentWallet.address}`)
  console.log('─'.repeat(50))

  console.log('\nNext steps:')
  console.log('1. Copy the values above into your .env file')
  console.log('2. Fund the AGENT wallet with test USDC on Arc Testnet (Chain ID 1116):')
  console.log('   → Bridge or faucet USDC to Arc Testnet')
  console.log(`   → USDC contract: 0x3600000000000000000000000000000000000000`)
  console.log(`   → Agent wallet address: ${agentWallet.address}`)
  console.log('3. Start the server: npm run dev')
  console.log('4. Start the agent:  npm run agent\n')
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message)
  if (err.response?.data) {
    console.error('Circle API error:', JSON.stringify(err.response.data, null, 2))
  }
  process.exit(1)
})
