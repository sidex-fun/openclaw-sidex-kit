import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// import { fetch } from 'node-fetch'; // Standard in Node 18+

const { values } = parseArgs({
    options: {
        symbol: { type: 'string' },
        side: { type: 'string' },
        amount: { type: 'string' },
        leverage: { type: 'string' },
        api_key: { type: 'string' },
        api_secret: { type: 'string' }
    },
});

const { symbol, side, amount, leverage, api_key, api_secret } = values;

const DEBUG_LOG = path.join(path.dirname(process.argv[1]), 'binance_debug.log');
fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} - Binance Pipeline started: ${JSON.stringify(values)}\n`);

if (!symbol || !side || !amount || !api_key || !api_secret) {
    console.error("Missing required arguments: symbol, side, amount, api_key, api_secret");
    process.exit(1);
}

const BASE_URL = 'https://fapi.binance.com'; // Futures API

console.log(`Binance CEX Pipeline connecting...`);

// Helper to sign query string
function signature(query, secret) {
    return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

async function executeTrade() {
    try {
        console.log(`✅ Pipeline: Preparing trade for ${symbol} ${side.toUpperCase()}`);

        // 0. Set Leverage (Optional step in Binance, often required before order)
        if (leverage) {
            console.log(`⚙️  Setting Leverage to ${leverage}x`);
            // POST /fapi/v1/leverage logic here
        }

        // 1. Prepare Order Payload
        const timestamp = Date.now();
        const queryParams = [
            `symbol=${symbol.replace('/', '')}`, // Binance format BTCUSDT, not BTC/USDT
            `side=${side.toUpperCase()}`,
            `type=MARKET`,
            `quantity=${amount}`,
            // `reduceOnly=false`,
            `timestamp=${timestamp}`
        ].join('&');

        const sig = signature(queryParams, api_secret);
        const signedQuery = `${queryParams}&signature=${sig}`;

        console.log(`🚀 Sending Signed Order to Binance Futures API`);
        console.log(`   Endpoint: ${BASE_URL}/fapi/v1/order`);
        console.log(`   Payload: ${queryParams}`);

        // Mock Fetch for Pipeline Structure
        // const res = await fetch(`${BASE_URL}/fapi/v1/order?${signedQuery}`, {
        //     method: 'POST',
        //     headers: { 'X-MBX-APIKEY': api_key }
        // });

        const mockResponse = {
            status: "FILLED",
            orderId: 123456789,
            symbol: symbol.replace('/', ''),
            executedQty: amount,
            avgPrice: "50000.00",
            cumQuote: "500.00"
        };

        console.log('✅ Trade Executed Successfully (Mock)');

        // Log trade locally
        const logEntry = {
            timestamp: new Date().toISOString(),
            exchange: 'binance',
            symbol,
            side,
            amount: parseFloat(amount),
            leverage: parseFloat(leverage || 1),
            result: mockResponse
        };

        const logPath = path.join(path.dirname(process.argv[1]), '..', '..', '..', 'trades.json');
        try {
            fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        } catch (e) { }

    } catch (error) {
        console.error("Pipeline Error:", error);
        process.exit(1);
    }
}

executeTrade();
