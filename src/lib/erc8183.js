const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')
const config = require('../config')

const ERC8183_CONTRACT = '0x0747EEf0706327138c69792bF28Cd525089e4583'
const USDC_CONTRACT = '0x3600000000000000000000000000000000000000'
const JOB_PRICE_RAW = '1' // 0.000001 USDC

function getClient() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  })
}

async function waitForTx(client, txId, maxAttempts = 20) {
  const terminal = new Set(['COMPLETE', 'FAILED', 'CANCELLED'])
  for (let i = 0; i < maxAttempts; i++) {
    const res = await client.getTransaction({ id: txId })
    const tx = res.data?.transaction
    console.log(`[waitForTx] attempt ${i+1}: state=${tx?.state}, txHash=${tx?.txHash}`)
    if (tx && terminal.has(tx.state)) {
      tx.txHash = tx.txHash || tx.transactionHash || null
      return tx
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Transaction timeout')
}

// Create an ERC-8183 job on-chain
// Returns { jobId, txHash, state: 'FUNDED' }
async function createJob({ providerAddress, description, walletId }) {
  const client = getClient()
  const apiWalletId = process.env.API_WALLET_ID
  const apiWalletAddress = process.env.API_WALLET_ADDRESS

  // Step 1: createJob on-chain
  const expiredAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour
  const createTx = await client.createContractExecutionTransaction({
    walletId: apiWalletId,
    contractAddress: ERC8183_CONTRACT,
    blockchain: 'ARC-TESTNET',
    abiFunctionSignature: 'createJob(address,address,uint256,string,address)',
    abiParameters: [
      providerAddress || apiWalletAddress,
      apiWalletAddress, // evaluator = API itself
      `${expiredAt}`,
      description,
      '0x0000000000000000000000000000000000000000',
    ],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  const createTxId = createTx.data?.id
  const createResult = await waitForTx(client, createTxId)
  if (createResult.state !== 'COMPLETE') throw new Error('createJob tx failed')

  // Get jobId from logs (use txHash as proxy jobId if needed)
  const jobId = createResult.txHash

  // Step 2: setBudget
  await client.createContractExecutionTransaction({
    walletId: apiWalletId,
    contractAddress: ERC8183_CONTRACT,
    blockchain: 'ARC-TESTNET',
    abiFunctionSignature: 'setBudget(uint256,uint256,bytes)',
    abiParameters: [jobId, JOB_PRICE_RAW, '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  // Step 3: approve USDC
  await client.createContractExecutionTransaction({
    walletId: apiWalletId,
    contractAddress: USDC_CONTRACT,
    blockchain: 'ARC-TESTNET',
    abiFunctionSignature: 'approve(address,uint256)',
    abiParameters: [ERC8183_CONTRACT, JOB_PRICE_RAW],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  // Step 4: fund — USDC into escrow
  const fundTx = await client.createContractExecutionTransaction({
    walletId: apiWalletId,
    contractAddress: ERC8183_CONTRACT,
    blockchain: 'ARC-TESTNET',
    abiFunctionSignature: 'fund(uint256,bytes)',
    abiParameters: [jobId, '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  const fundResult = await waitForTx(client, fundTx.data?.id)

  return {
    jobId,
    txHash: fundResult.txHash,
    state: 'FUNDED',
    contractAddress: ERC8183_CONTRACT,
    arcScanUrl: fundResult.txHash ? `https://testnet.arcscan.app/tx/${fundResult.txHash}` : `https://testnet.arcscan.app/address/${process.env.API_WALLET_ADDRESS}`,
  }
}

// Submit deliverable and complete job — releases USDC escrow
async function completeJob({ jobId, deliverableHash }) {
  const client = getClient()
  const apiWalletId = process.env.API_WALLET_ID

  // submit deliverable
  const submitTx = await client.createContractExecutionTransaction({
    walletId: apiWalletId,
    contractAddress: ERC8183_CONTRACT,
    blockchain: 'ARC-TESTNET',
    abiFunctionSignature: 'submit(uint256,bytes32,bytes)',
    abiParameters: [jobId, deliverableHash || '0x' + '0'.repeat(64), '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  await waitForTx(client, submitTx.data?.id)

  // complete — evaluator releases payment
  const completeTx = await client.createContractExecutionTransaction({
    walletId: apiWalletId,
    contractAddress: ERC8183_CONTRACT,
    blockchain: 'ARC-TESTNET',
    abiFunctionSignature: 'complete(uint256,bytes32,bytes)',
    abiParameters: [jobId, '0x' + '0'.repeat(64), '0x'],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  const completeResult = await waitForTx(client, completeTx.data?.id)

  return {
    jobId,
    txHash: completeResult.txHash,
    state: 'COMPLETED',
    arcScanUrl: `https://testnet.arcscan.app/tx/${completeResult.txHash}`,
  }
}

module.exports = { createJob, completeJob }
