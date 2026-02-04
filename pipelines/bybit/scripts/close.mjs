import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const { values } = parseArgs({
    options: {
        symbol: { type: 'string' },
        direction: { type: 'string' },
        api_key: { type: 'string' },
        api_secret: { type: 'string' }
    },
});

const { symbol, direction, api_key, api_secret } = values;

if (!symbol || !api_key || !api_secret) {
    console.error("Missing required arguments: symbol, api_key, api_secret");
    process.exit(1);
}

const BASE_URL = 'https://api.bybit.com';

console.log(`Bybit Pipeline: Closing position for ${symbol}...`);

function getSignature(parameters, secret, timestamp) {
    const recvWindow = '5000';
    // For GET requests, parameters is queryString
    const stringToSign = timestamp + api_key + recvWindow + parameters;
    return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

async function closePosition() {
    try {
        console.log(`🔍 Fetching Current Positions via ${BASE_URL}/v5/position/list`);

        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        const targetSymbol = symbol.replace('/', '');

        // GET Request Query
        const query = `category=linear&symbol=${targetSymbol}`;
        const sig = getSignature(query, api_secret, timestamp);

        // Mock Positions
        const mockPositions = [
            { symbol: targetSymbol, size: "150", side: "Buy" } // Bybit uses Buy/Sell sidebar for One-Way Mode, or index for Hedge
        ];

        const pos = mockPositions.find(p => p.symbol === targetSymbol);

        if (pos && parseFloat(pos.size) > 0) {
            console.log(`Found Position: ${pos.size} ${targetSymbol} (${pos.side})`);

            // To close, we send an opposing order
            const closeSide = pos.side === 'Buy' ? 'Sell' : 'Buy';
            console.log(`🚀 Sending Market ${closeSide} to Close`);

            const payload = {
                category: "linear",
                symbol: targetSymbol,
                side: closeSide,
                orderType: "Market",
                qty: pos.size,
                reduceOnly: true
            };

            // Sign payload...
            console.log("Payload:", JSON.stringify(payload));

            console.log("✅ Position Closed (Mock)");
        } else {
            console.log("No open position found to close.");
        }

    } catch (error) {
        console.error("Pipeline Error:", error);
    }
}

closePosition();
