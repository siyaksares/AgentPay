const express = require('express')
const router = express.Router()
const requirePayment = require('../middleware/requirePayment')

// ─── ON-CHAIN ANALYTICS ───────────────────────────────────────────────────────
// GET /api/onchain/analytics?address=0x...
router.get('/analytics', requirePayment, async (req, res) => {
  try {
    const address = req.query.address || process.env.API_WALLET_ADDRESS

    // Use Circle Wallets API for balance (more reliable than RPC on testnet)
    const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    })

    let balanceArc = '0'
    let balanceUsdc = '0'
    let txCount = 0

    try {
      const walletRes = await client.getWallet({ id: process.env.API_WALLET_ID })
      const wallet = walletRes.data?.wallet
      balanceArc = wallet?.balances?.find(b => b.token?.symbol === 'ARC')?.amount || '0'
      balanceUsdc = wallet?.balances?.find(b => b.token?.symbol === 'USDC')?.amount || '0'
    } catch (e) {
      // fallback
    }

    res.json({
      success: true,
      data: {
        address,
        balance: { arc: balanceArc, usdc: balanceUsdc },
        transactionCount: txCount,
        network: 'ARC-TESTNET',
        blockExplorer: `https://testnet.arcscan.app/address/${address}`,
        contract: '0x0747EEf0706327138c69792bF28Cd525089e4583',
        timestamp: new Date().toISOString(),
      },
      job: { id: req.job.jobId, txHash: req.job.txHash, arcScanUrl: req.job.arcScanUrl },
    })
  } catch (err) {
    res.status(500).json({ error: 'Analytics fetch failed', message: err.message })
  }
})

// ─── DEFI SIGNALS ─────────────────────────────────────────────────────────────
// GET /api/defi/signals?coin=bitcoin
router.get('/signals', requirePayment, async (req, res) => {
  try {
    const coin = req.query.coin || 'bitcoin'
    
    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coin}?localization=false&tickers=false&community_data=false&developer_data=false`
    )
    const cgData = await cgRes.json()

    const price = cgData.market_data?.current_price?.usd || 0
    const change24h = cgData.market_data?.price_change_percentage_24h || 0
    const change7d = cgData.market_data?.price_change_percentage_7d || 0
    const volume = cgData.market_data?.total_volume?.usd || 0
    const marketCap = cgData.market_data?.market_cap?.usd || 0
    const ath = cgData.market_data?.ath?.usd || 0
    const athChangePercent = cgData.market_data?.ath_change_percentage?.usd || 0

    // Generate signal based on momentum
    let signal = 'NEUTRAL'
    let confidence = 50
    if (change24h > 3 && change7d > 5) { signal = 'BUY'; confidence = 72 }
    else if (change24h < -3 && change7d < -5) { signal = 'SELL'; confidence = 68 }
    else if (change24h > 1) { signal = 'WEAK_BUY'; confidence = 55 }
    else if (change24h < -1) { signal = 'WEAK_SELL'; confidence = 53 }

    res.json({
      success: true,
      data: {
        coin: cgData.id,
        name: cgData.name,
        symbol: cgData.symbol?.toUpperCase(),
        price: { usd: price },
        changes: { h24: change24h, d7: change7d },
        volume24h: volume,
        marketCap,
        ath: { price: ath, changePercent: athChangePercent },
        signal: { action: signal, confidence: `${confidence}%`, basis: 'momentum_24h_7d' },
        timestamp: new Date().toISOString(),
      },
      job: { id: req.job.jobId, txHash: req.job.txHash, arcScanUrl: req.job.arcScanUrl },
    })
  } catch (err) {
    res.status(500).json({ error: 'DeFi signals fetch failed', message: err.message })
  }
})

// ─── AI SUMMARIZER ────────────────────────────────────────────────────────────
// POST /api/ai/summarize   body: { text }
router.post('/summarize', requirePayment, async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ error: 'text field required' })

    const words = text.trim().split(/\s+/)
    const wordCount = words.length
    const sentences = text.split(/[.!?]+/).filter(Boolean)
    const keyPhrases = [...new Set(words.filter(w => w.length > 6))].slice(0, 8)
    const summary = sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '...' : '')
    const sentiment = wordCount > 0 ? (
      text.match(/\b(good|great|excellent|positive|profit|gain|bull)\b/gi)?.length || 0) >
      (text.match(/\b(bad|poor|negative|loss|bear|crash|risk)\b/gi)?.length || 0)
      ? 'POSITIVE' : 'NEUTRAL'
    : 'NEUTRAL'

    res.json({
      success: true,
      data: {
        summary,
        wordCount,
        sentenceCount: sentences.length,
        keyPhrases,
        sentiment,
        readingTimeSeconds: Math.ceil(wordCount / 3),
        timestamp: new Date().toISOString(),
      },
      job: { id: req.job.jobId, txHash: req.job.txHash, arcScanUrl: req.job.arcScanUrl },
    })
  } catch (err) {
    res.status(500).json({ error: 'AI summarize failed', message: err.message })
  }
})

// ─── MACRO DATA FEED ──────────────────────────────────────────────────────────
// GET /api/data/macro
router.get('/macro', requirePayment, async (req, res) => {
  try {
    // Fetch BTC + ETH + USDC data from CoinGecko as macro proxy
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin,arc&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'
    )
    const prices = await cgRes.json()

    res.json({
      success: true,
      data: {
        markets: {
          bitcoin: { price: prices.bitcoin?.usd, change24h: prices.bitcoin?.usd_24h_change, marketCap: prices.bitcoin?.usd_market_cap },
          ethereum: { price: prices.ethereum?.usd, change24h: prices.ethereum?.usd_24h_change, marketCap: prices.ethereum?.usd_market_cap },
          usdc: { price: prices['usd-coin']?.usd, change24h: prices['usd-coin']?.usd_24h_change },
        },
        riskSentiment: (prices.bitcoin?.usd_24h_change || 0) > 0 ? 'RISK_ON' : 'RISK_OFF',
        timestamp: new Date().toISOString(),
        source: 'CoinGecko',
      },
      job: { id: req.job.jobId, txHash: req.job.txHash, arcScanUrl: req.job.arcScanUrl },
    })
  } catch (err) {
    res.status(500).json({ error: 'Macro data fetch failed', message: err.message })
  }
})

// ─── USDC ANALYTICS ───────────────────────────────────────────────────────────
// GET /api/data/usdc
router.get('/usdc', requirePayment, async (req, res) => {
  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/usd-coin?localization=false&tickers=false&community_data=false&developer_data=false'
    )
    const data = await cgRes.json()

    res.json({
      success: true,
      data: {
        price: { usd: data.market_data?.current_price?.usd },
        marketCap: data.market_data?.market_cap?.usd,
        volume24h: data.market_data?.total_volume?.usd,
        circulatingSupply: data.market_data?.circulating_supply,
        pegDeviation: ((data.market_data?.current_price?.usd || 1) - 1).toFixed(6),
        pegStatus: Math.abs((data.market_data?.current_price?.usd || 1) - 1) < 0.005 ? 'STABLE' : 'DEPEGGED',
        arcSettlement: {
          contract: '0x3600000000000000000000000000000000000000',
          network: 'ARC-TESTNET',
          erc8183Contract: '0x0747EEf0706327138c69792bF28Cd525089e4583',
        },
        timestamp: new Date().toISOString(),
      },
      job: { id: req.job.jobId, txHash: req.job.txHash, arcScanUrl: req.job.arcScanUrl },
    })
  } catch (err) {
    res.status(500).json({ error: 'USDC data fetch failed', message: err.message })
  }
})

module.exports = router
