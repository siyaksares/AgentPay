const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')

const API_KEY = 'TEST_API_KEY:d3a8d13bec4874d5688a2b36141393b8:e278e9b1d165e91b323a3a4037584dc6'
const ENTITY_SECRET = 'b0515f20dd10fe04840bde0901638f40e12d3f772e3a9468eed09c5bc1ec5769'

const client = initiateDeveloperControlledWalletsClient({
  apiKey: API_KEY,
  entitySecret: ENTITY_SECRET,
  baseUrl: 'https://api.circle.com',
})

async function main() {
  console.log('Attempting createTransaction...\n')
  try {
    const res = await client.createTransaction({
      walletId: 'f9705968-db35-57cd-8a4b-13d03b6e2ce2',
      destinationAddress: '0xc321eefd3373bc52e9c21127c58e10c6bb374933',
      amount: ['0.001'],
      tokenAddress: '0x3600000000000000000000000000000000000000',
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    })
    console.log('Success:', JSON.stringify(res.data, null, 2))
  } catch (err) {
    console.error('Error class:', err.constructor?.name)
    console.error('err.message:', err.message)
    console.error('err.status:', err.status)
    console.error('err.code:', err.code)
    console.error('err.url:', err.url)
    console.error('err.method:', err.method)
    for (const k of Object.getOwnPropertyNames(err)) {
      if (k !== 'stack' && k !== 'message') {
        console.error(`err.${k}:`, JSON.stringify(err[k]))
      }
    }
  }
}

main()
