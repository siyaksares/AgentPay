const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')
const config = require('../config')

const client = initiateDeveloperControlledWalletsClient({
  apiKey: config.circle.apiKey,
  entitySecret: config.circle.entitySecret,
})

const ERC_8183 = '0x0747EEf0706327138c69792bF28Cd525089e4583'
const USDC = '0x3600000000000000000000000000000000000000'
const BLOCKCHAIN = 'ARC-TESTNET'

// Create a job on ERC-8183 contract
async function createJob({ providerAddress, description, budgetUsdc = '1000' }) {
  const expiredAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour

  const tx = await client.createContractExecutionTransaction({
    walletAddress: config.wallet.apiWalletAddress,
    blockchain: BLOCKCHAIN,
    contractAddress: ERC_8183,
    abiFunctionSignature: 'createJob(address,address,uint256,string,address)',
    abiParameters: [
      providerAddress,
      config.wallet.apiWalletAddress, // evaluator = server
      `${expiredAt}`,
      description,
      '0x0000000000000000000000000000000000000000',
    ],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  return tx.data?.transaction
}

// Set budget for a job
async function setBudget({ jobId, amountUsdc }) {
  const amount = Math.floor(parseFloat(amountUsdc) * 1e6).toString()

  const tx = await client.createContractExecutionTransaction({
    walletAddress: config.wallet.agentWalletAddress,
    blockchain: BLOCKCHAIN,
    contractAddress: ERC_8183,
    abiFunctionSignature: 'setBudget(uint256,uint256,bytes)',
    abiParameters: [jobId.toString(), amount, '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  return tx.data?.transaction
}

// Approve + Fund job into escrow
async function fundJob({ jobId, amountUsdc }) {
  const amount = Math.floor(parseFloat(amountUsdc) * 1e6).toString()

  // Approve
  await client.createContractExecutionTransaction({
    walletAddress: config.wallet.agentWalletAddress,
    blockchain: BLOCKCHAIN,
    contractAddress: USDC,
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [ERC_8183, amount],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  // Fund
  const tx = await client.createContractExecutionTransaction({
    walletAddress: config.wallet.agentWalletAddress,
    blockchain: BLOCKCHAIN,
    contractAddress: ERC_8183,
    abiFunctionSignature: 'fund(uint256,bytes)',
    abiParameters: [jobId.toString(), '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  return tx.data?.transaction
}

// Submit deliverable
async function submitJob({ jobId, deliverableHash }) {
  const tx = await client.createContractExecutionTransaction({
    walletAddress: config.wallet.agentWalletAddress,
    blockchain: BLOCKCHAIN,
    contractAddress: ERC_8183,
    abiFunctionSignature: 'submit(uint256,bytes32,bytes)',
    abiParameters: [jobId.toString(), deliverableHash, '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  return tx.data?.transaction
}

// Complete job → release payment
async function completeJob({ jobId }) {
  const reasonHash = '0x' + Buffer.from('API_DELIVERED').toString('hex').padEnd(64, '0')

  const tx = await client.createContractExecutionTransaction({
    walletAddress: config.wallet.apiWalletAddress, // evaluator
    blockchain: BLOCKCHAIN,
    contractAddress: ERC_8183,
    abiFunctionSignature: 'complete(uint256,bytes32,bytes)',
    abiParameters: [jobId.toString(), reasonHash, '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  return tx.data?.transaction
}

module.exports = { createJob, setBudget, fundJob, submitJob, completeJob, ERC_8183, USDC }
