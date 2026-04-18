# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# One-time wallet setup (creates Circle wallets, prints .env values)
npm run setup

# Start API server (dev with auto-reload)
npm run dev

# Start API server (production)
npm start

# Run the AI agent simulator (separate terminal)
npm run agent
```

## Architecture

**AgentPay** is a per-request API payment middleware. Every API call must be accompanied by a 0.001 USDC micro-payment via Circle Programmable Wallets. The pattern:

```
Agent → POST /api/pay/transfer → Circle transfer (0.001 USDC)
Agent → polls GET /api/pay/status/:id until state=COMPLETE
Agent → GET /api/weather  [X-Payment-Id: <transferId>]
Middleware → verifyPayment() → Circle API confirms COMPLETE + correct amount + correct destination
Server → returns weather data
```

**Key files:**
- `src/lib/circle.js` — Circle API client: entity secret encryption (RSA-OAEP), wallet CRUD, transfer initiation, payment verification
- `src/middleware/requirePayment.js` — verifies Circle transfer before serving any response; also handles replay attack prevention via `store.js`
- `src/store.js` — in-memory store for used payment IDs and dashboard stats (swap for Redis in production)
- `agent/index.js` — standalone process; runs the full pay-then-request loop on an interval
- `scripts/setup-wallets.js` — one-time Circle wallet provisioning

**Payment verification checks** (in `requirePayment.js`):
1. Transfer exists and `state === 'COMPLETE'`
2. `destinationAddress` matches `API_WALLET_ADDRESS`
3. `amount >= 0.001 USDC`
4. Transfer ID not previously used (replay protection)

## Configuration

Copy `.env.example` to `.env`. Required vars:
- `CIRCLE_API_KEY` — from https://console.circle.com (sandbox tier is free)
- `CIRCLE_ENTITY_SECRET` — 32-byte hex; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `CIRCLE_BLOCKCHAIN=ARC-TESTNET` — Arc Testnet blockchain identifier for Circle Wallets SDK
- `USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000` — USDC on Arc Testnet
- `ARC_RPC_URL=https://rpc.arcscan.net`, `ARC_CHAIN_ID=1116`
- Wallet IDs/addresses — populated by `npm run setup`

## Vercel Deployment

```bash
vercel --prod
# Set env vars in Vercel dashboard under Project Settings → Environment Variables
```

The Express server is deployed as a single Vercel serverless function. Static assets in `public/` are served directly.
