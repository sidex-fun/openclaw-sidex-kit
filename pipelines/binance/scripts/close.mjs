import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const { values } = parseArgs({
    options: {
        symbol: { type: 'string' },
        direction: { type: 'string' }, // 'long' 'short' matches Moltbot structure
        api_key: { type: 'string' },
        api_secret: { type: 'string' }
    },
});

const { symbol, direction, api_key, api_secret } = values;

if (!symbol || !api_key || !api_secret) {
    console.error("Missing required arguments: symbol, api_key, api_secret");
    process.exit(1);
}

const BASE_URL = 'https://fapi.binance.com';

console.log(`Binance Pipeline: Closing position for ${symbol}...`);

function signature(query, secret) {
    return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

async function closePosition() {
    try {
        console.log(`🔍 Fetching Current Positions via ${BASE_URL}/fapi/v2/positionRisk`);

        // 1. Get Positions
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}`;
        const sig = signature(query, api_secret);

        // Mock Response of positions
        const mockPositions = [
            { symbol: "BTCUSDT", positionAmt: "0.5", entryPrice: "50000" }
        ];

        const targetSymbol = symbol.replace('/', '');
        const pos = mockPositions.find(p => p.symbol === targetSymbol);

        if (pos && parseFloat(pos.positionAmt) !== 0) {
            const sideToClose = parseFloat(pos.positionAmt) > 0 ? 'SELL' : 'BUY';
            const amountToClose = Math.abs(parseFloat(pos.positionAmt));

            console.log(`Found Position: ${pos.positionAmt} ${targetSymbol}`);
            console.log(`🚀 Sending Market ${sideToClose} to Close`);

            const orderQuery = `symbol=${targetSymbol}&side=${sideToClose}&type=MARKET&quantity=${amountToClose}&reduceOnly=true&timestamp=${Date.now()}`;
            // Sign and Send...

            console.log("✅ Position Closed (Mock)");
        } else {
            console.log("No open position found to close.");
        }

    } catch (error) {
        console.error("Pipeline Error:", error);
    }
}

closePosition();
