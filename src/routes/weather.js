const express = require('express')
const { createGatewayMiddleware } = require('@circle-fin/x402-batching/server')
const gateway = createGatewayMiddleware({
  sellerAddress: process.env.API_WALLET_ADDRESS,
  networks: 'arcTestnet',
  description: 'AgentPay Weather API - Pay-per-use on Arc Testnet'
})

const router = express.Router()

const CITIES = {
  'new-york': {
    city: 'New York',
    country: 'US',
    temperature: { celsius: 22, fahrenheit: 72 },
    condition: 'Partly Cloudy',
    humidity: 65,
    windSpeed: '14 km/h',
    icon: '⛅',
  },
  london: {
    city: 'London',
    country: 'GB',
    temperature: { celsius: 15, fahrenheit: 59 },
    condition: 'Rainy',
    humidity: 80,
    windSpeed: '20 km/h',
    icon: '🌧️',
  },
  tokyo: {
    city: 'Tokyo',
    country: 'JP',
    temperature: { celsius: 28, fahrenheit: 82 },
    condition: 'Sunny',
    humidity: 55,
    windSpeed: '8 km/h',
    icon: '☀️',
  },
  sydney: {
    city: 'Sydney',
    country: 'AU',
    temperature: { celsius: 19, fahrenheit: 66 },
    condition: 'Windy',
    humidity: 70,
    windSpeed: '30 km/h',
    icon: '🌬️',
  },
}

const CITIES_LIST = Object.keys(CITIES)

// GET /api/weather?city=london  (requires X-Payment-Id header)
router.get('/', gateway.require('$0.000001'), (req, res) => {
  const cityKey = (req.query.city || 'new-york').toLowerCase().replace(/\s+/g, '-')
  const weather = CITIES[cityKey] || CITIES[CITIES_LIST[Math.floor(Math.random() * CITIES_LIST.length)]]

  res.json({
    success: true,
    data: {
      ...weather,
      timestamp: new Date().toISOString(),
      // Small variation to show live data feel
      temperature: {
        ...weather.temperature,
        celsius: weather.temperature.celsius + (Math.random() * 2 - 1).toFixed(1) * 1,
      },
    },
    payment: {
      id: req.payment?.transaction || 'nanopayment',
      amount: req.payment?.amount || '$0.000001',
      from: req.payment?.payer || 'agent',
      verified: req.payment?.verified,
    },
    availableCities: CITIES_LIST,
  })
})

module.exports = router
