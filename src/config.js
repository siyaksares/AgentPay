require('dotenv').config()

module.exports = {
  circle: {
    apiKey: process.env.CIRCLE_API_KEY || '',
    entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
    baseUrl: 'https://api.circle.com',
    blockchain: process.env.CIRCLE_BLOCKCHAIN || 'ARC-TESTNET',
    walletSetId: process.env.CIRCLE_WALLET_SET_ID || '',
    usdcTokenId: process.env.CIRCLE_USDC_TOKEN_ID || '',
  },
  wallet: {
    apiWalletId: process.env.API_WALLET_ID || '',
    apiWalletAddress: process.env.API_WALLET_ADDRESS || '',
    agentWalletId: process.env.AGENT_WALLET_ID || '',
    agentWalletAddress: process.env.AGENT_WALLET_ADDRESS || '',
  },
  arc: {
    rpcUrl: process.env.ARC_RPC_URL || 'https://rpc.arcscan.net',
    chainId: parseInt(process.env.ARC_CHAIN_ID || '5042002'),
    usdcAddress: process.env.USDC_CONTRACT_ADDRESS || '0x3600000000000000000000000000000000000000',
  },
  payment: {
    // 0.000001 USDC — USDC has 6 decimals, so this is 1 raw unit
    amountUsdc: '0.000001',
    amountRaw: 1n,
    // How many seconds a payment nonce stays valid
    nonceExpirySeconds: 120,
  },
  port: parseInt(process.env.PORT || '3000'),
  isDev: process.env.NODE_ENV !== 'production',
}
