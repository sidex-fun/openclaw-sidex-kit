import { PolymarketClient } from './polymarket_client.js';
import { SocialSentimentAnalyzer } from '../../market_intelligence/social_sentiment.js';

// Configuration
const POLL_INTERVAL = 10000; // 10 seconds (Accelerated for demo)
const TRADE_AMOUNT_USDC = 50;

// Simulated Social Feed (since we don't have a live Twitter API connection in this kit yet)
const SIMULATED_FEED = [
    { text: "Just hearing that the SEC is about to ban all crypto staking!", author: "WatcherGuru", source: "Twitter" },
    { text: "Trump just announced he is buying Bitcoin for the national reserve! Huge!", author: "realDonaldTrump", source: "TruthSocial" },
    { text: "I had a nice sandwich today.", author: "randomUser", source: "Twitter" },
    { text: "Fed expected to cut rates by 50bps next meeting. Bullish for assets.", author: "ZeroHedge", source: "Twitter" }
];

async function runSentimentAgent() {
    console.log('🧠 Starting Social Sentiment Agent...');
    console.log('-------------------------------------');

    const client = new PolymarketClient();
    const analyzer = new SocialSentimentAnalyzer();

    await client.init();

    let feedIndex = 0;

    while (true) {
        console.log(`\n⏳ [${new Date().toISOString()}] Listening for signals...`);

        // 1. Get next "tweet"
        const post = SIMULATED_FEED[feedIndex % SIMULATED_FEED.length];
        feedIndex++;

        console.log(`📨 Incoming Post [${post.author}]: "${post.text}"`);

        // 2. Analyze Sentiment
        const analysis = await analyzer.analyze(post.text, post.source, post.author);

        if (analysis.is_trading_related && analysis.impact_level !== 'LOW') {
            console.log(`🚨 SIGNAL DETECTED: ${analysis.instruction}`);
            console.log(`   Confidence: ${analysis.confidence * 100}% | Impact: ${analysis.impact_level}`);

            // 3. Trade Execution Logic
            if (analysis.forecast_direction !== 'NEUTRAL') {

                // Find relevant market
                // In a real system, we'd use semantic search. Here we use basic keyword matching.
                const markets = await client.getMarkets(20);

                // Simple keyword matching based on post content
                const keywords = post.text.split(' ').filter(w => w.length > 4);
                let targetMarket = markets.find(m => keywords.some(k => m.question.toLowerCase().includes(k.toLowerCase())));

                // Fallback for demo purposes if no specific market found
                if (!targetMarket && markets.length > 0) {
                    targetMarket = markets[0];
                    console.log(`⚠️ No specific market found for keywords. Targeting top market for demo: "${targetMarket.question}"`);
                }

                if (targetMarket) {
                    const side = 'buy';
                    const outcome = analysis.forecast_direction === 'BULLISH' ? 'YES' : 'NO';

                    console.log(`⚡ Executing Sentiment Trade: ${side.toUpperCase()} ${outcome} on market ${targetMarket.id}`);
                    await client.createOrder(targetMarket.id, side, TRADE_AMOUNT_USDC, outcome);
                }
            } else {
                console.log("   Direction is NEUTRAL. No trade executed.");
            }

        } else {
            console.log("   Ignored: Not actionable or low impact.");
        }

        console.log(`💤 Sleeping for ${POLL_INTERVAL / 1000}s...`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

runSentimentAgent();
