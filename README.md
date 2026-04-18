# AgentPay

> Per-request USDC micropayments for AI agents — built on ARC Testnet

AgentPay is a Web3 payment middleware that lets AI agents pay per API request using USDC on the ARC blockchain. Each API call requires a valid Circle transfer ID in the `X-Payment-Id` header.

## 🌐 Live Demo

**Base URL:** `https://agentpay-production-7a2a.up.railway.app`

## 🔌 Endpoints

### 1. Weather API
Returns current weather data for the given city.

### 2. Crypto Price
Returns current price data for any cryptocurrency.

### 3. Exchange Rate
Returns the current exchange rate between two assets via CoinGecko.

## 💳 How Payments Work

1. **Initiate payment:** `POST /api/pay/initiate`
2. **Poll status:** `GET /api/pay/status/:id`
3. **Use the transfer ID** as `X-Payment-Id` header on any endpoint
4. Each transfer ID can only be used **once** (replay protection)

## ⚙️ Tech Stack

- **Runtime:** Node.js + Express
- **Blockchain:** ARC Testnet (Circle USDC)
- **Payment:** Circle Programmable Wallets API
- **Deploy:** Railway

## 🚀 Run Locally

```bash
git clone https://github.com/siyaksares/AgentPay
cd AgentPay
npm install
cp .env.example .env
# Fill in your API keys in .env
npm start
```

## 🔑 Environment Variables

See `.env.example` for required variables.

---

Built for the **Q1 2026 ARC Hackathon** 🏆
