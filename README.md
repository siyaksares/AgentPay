# AgentPay

> The first ERC-8183 powered API marketplace for AI agents — built on Arc Testnet

AgentPay lets AI agents pay per API request using USDC on Arc L1. Every API call is a structured on-chain job: work defined, USDC escrowed, deliverable verified, payment released trustlessly via ERC-8183.

No subscriptions. No API keys. No human authorization. Just agents transacting.

## 🌐 Live Demo

**Dashboard:** https://agentpay-production-7a2a.up.railway.app  
**Docs:** https://agentpay-production-7a2a.up.railway.app/docs.html  
**ERC-8183 Contract:** `0x0747EEf0706327138c69792bF28Cd525089e4583` (Arc Testnet)  
**Arc Explorer:** https://testnet.arcscan.app

## ⚡ ERC-8183 Job Lifecycle
## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/job/create` | Create ERC-8183 job, escrow USDC |
| GET | `/api/job/status/:id` | Poll job lifecycle state |
| GET | `/api/onchain/analytics` | Live Arc Testnet wallet analytics |
| GET | `/api/defi/signals?coin=bitcoin` | DeFi trading signals (BUY/SELL/NEUTRAL) |
| POST | `/api/ai/summarize` | AI text summarizer with sentiment |
| GET | `/api/data/macro` | Macro market data (BTC, ETH, USDC) |
| GET | `/api/data/usdc` | USDC peg analytics on Arc |
| GET | `/api/weather?city=london` | Weather data feed |
| GET | `/api/crypto?coin=bitcoin` | Crypto price via CoinGecko |

All data endpoints require `X-Job-Id` header with a valid funded job ID.

## 🤖 Agent Demo

```bash
cd agent && node demo.js
```

This runs a full autonomous agent flow:
1. Creates an ERC-8183 job on Arc Testnet
2. Escrows USDC into the contract
3. Calls a gated API endpoint
4. Verifies deliverable on-chain
5. Releases payment trustlessly

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express |
| Blockchain | Arc Testnet (L1, Chain ID 1116) |
| Smart Contract | ERC-8183 (`0x0747EEf...4583`) |
| Payment Token | USDC (`0x3600...0000`) |
| Wallet Infra | Circle Programmable Wallets API |
| Data | CoinGecko API |
| Deploy | Railway (auto-deploy from GitHub) |

## 🚀 Run Locally

```bash
git clone https://github.com/siyaksares/AgentPay
cd AgentPay
npm install
cp .env.example .env
# Fill in CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, API_WALLET_ID, API_WALLET_ADDRESS
npm start
```

## 🔐 Authentication

Every gated endpoint requires a valid ERC-8183 job ID:

```bash
# 1. Create a job
curl -X POST https://agentpay-production-7a2a.up.railway.app/api/job/create \
  -H "Content-Type: application/json" \
  -d '{"description": "DeFi signal for bitcoin"}'

# 2. Use the jobId
curl "https://agentpay-production-7a2a.up.railway.app/api/defi/signals?coin=bitcoin" \
  -H "X-Job-Id: <jobId from step 1>"
```

Each job ID is single-use — replay attacks are impossible.

## 📋 Environment Variables

```env
CIRCLE_API_KEY=             # Circle Developer Console
CIRCLE_ENTITY_SECRET=       # 32-byte hex string
CIRCLE_BLOCKCHAIN=ARC-TESTNET
API_WALLET_ID=              # From npm run setup
API_WALLET_ADDRESS=         # From npm run setup
ARC_RPC_URL=https://rpc.arcscan.net
ARC_CHAIN_ID=1116
USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
```

---

Built for the **Q1 2026 ARC Hackathon** 🏆  
*Agentic Economy on Arc — Circle + Arc Testnet*
