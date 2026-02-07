import { PolymarketClient } from './polymarket_client.js';

// Configuration
const POLL_INTERVAL = 60000; // 60 seconds
const TRADE_AMOUNT_USDC = 5;

async function runAgent() {
    console.log('🤖 Starting Polymarket Autonomous Agent...');
    console.log('-----------------------------------------');

    const client = new PolymarketClient();
    await client.init();

    while (true) {
        try {
            console.log(`\n🕐 [${new Date().toISOString()}] Scanning Markets...`);

            // 1. Fetch Markets
            const markets = await client.getMarkets(5);

            if (markets.length === 0) {
                console.log('No active markets found. Sleeping...');
            } else {
                // 2. Simple Strategy: Pick the first market and bet on the underdog (Simulated Logic)
                const targetMarket = markets[0];
                console.log(`🎯 Targeting Market: "${targetMarket.question}"`);

                // 3. Execute Trade (Simulated)
                // In a real strategy, you would calculate EV here.
                const side = 'buy';
                const outcome = 'YES'; // Simplified

                console.log(`💡 Strategy Decision: BUY YES on "${targetMarket.question}"`);

                await client.createOrder(targetMarket.id, side, TRADE_AMOUNT_USDC, outcome);
                console.log('✅ Cycle Complete.');
            }

        } catch (error) {
            console.error('❌ Agent Loop Error:', error.message);
        }

        console.log(`💤 Sleeping for ${POLL_INTERVAL / 1000}s...`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

runAgent();
