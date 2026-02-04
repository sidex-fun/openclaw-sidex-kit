import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';

const { values } = parseArgs({
    options: {
        symbol: { type: 'string' },
        direction: { type: 'string' }, // 'long' 'short' or 'all'
        private_key: { type: 'string' },
        wallet_address: { type: 'string' }
    },
    allowPositionals: true
});

// Support positional args roughly like the other script: close.mjs <symbol> <direction> <key>
const symbol = values.symbol || process.argv[2];
const direction = values.direction || process.argv[3];
const private_key = values.private_key || process.argv[4];

if (!symbol || !private_key) {
    console.error("Missing required arguments: symbol, private_key");
    process.exit(1);
}

console.log(`Hyperliquid Pipeline: Closing position for ${symbol}...`);

async function closePosition() {
    try {
        // Logic to fetch position size first
        // const positions = await fetchPositions(wallet_address);
        // const pos = positions.find(p => p.coin === symbol);
        // const size = pos.szi; 

        console.log(`🔍 Checking Open Positions for ${symbol}`);

        // Mock finding a position
        const mockPosition = { coin: symbol, size: "100.0", side: "long" };
        console.log(`Found position: ${JSON.stringify(mockPosition)}`);

        if (mockPosition) {
            console.log(`🚀 Sending Close Order (Market Sell of ${mockPosition.size})`);
            // Send market order to close
        } else {
            console.log("No open position found to close.");
        }

    } catch (error) {
        console.error("Pipeline Error:", error);
    }
}

closePosition();
