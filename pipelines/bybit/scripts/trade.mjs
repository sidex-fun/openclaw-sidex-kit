import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

const DEBUG_LOG = path.join(path.dirname(process.argv[1]), 'bybit_debug.log');
fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} - Bybit Pipeline started: ${JSON.stringify(values)}\n`);

if (!symbol || !side || !amount || !api_key || !api_secret) {
    console.error("Missing required arguments: symbol, side, amount, api_key, api_secret");
    process.exit(1);
}

const BASE_URL = 'https://api.bybit.com'; // V5 API

console.log(`Bybit CEX Pipeline connecting...`);

// Bybit V5 Signature
function getSignature(parameters, secret, timestamp) {
    const recvWindow = '5000';
    const data = parameters; // For GET used query, for POST use valid JSON string
    const stringToSign = timestamp + api_key + recvWindow + data;
    return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

async function executeTrade() {
    try {
        console.log(`✅ Pipeline: Preparing trade for ${symbol} ${side.toUpperCase()}`);

        // 1. Set Leverage (Bybit often requires setting this separately if changed)
        // Ignoring for simple trade pipeline demo, but would be POST /v5/position/set-leverage

        // 2. Prepare Order Payload
        // V5 Order Create: POST /v5/order/create
        // side: Buy/Sell
        // orderType: Market
        // qty: amount

        const timestamp = Date.now().toString();
        const recvWindow = '5000';

        const payload = {
            category: "linear", // USDT Perpetual
            symbol: symbol.replace('/', ''), // BTCUSDT
            side: side.charAt(0).toUpperCase() + side.slice(1).toLowerCase(), // Buy or Sell
            orderType: "Market",
            qty: amount,
            // timeInForce: "GTC" // Not needed for Market
        };

        const bodyStr = JSON.stringify(payload);
        const signature = getSignature(bodyStr, api_secret, timestamp);

        console.log(`🚀 Sending Signed Order to Bybit V5 API`);
        console.log(`   Endpoint: ${BASE_URL}/v5/order/create`);
        console.log(`   Payload: ${bodyStr}`);

        // Mock Fetch
        /*
        const response = await fetch(`${BASE_URL}/v5/order/create`, {
            method: 'POST',
            headers: {
                'X-BAPI-API-KEY': api_key,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-SIGN': signature,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'Content-Type': 'application/json'
            },
            body: bodyStr
        });
        */

        const mockResponse = {
            retCode: 0,
            retMsg: "OK",
            result: {
                orderId: "1383838838",
                orderLinkId: "xxxx-xxxx"
            }
        };

        if (mockResponse.retCode === 0) {
            console.log('✅ Trade Executed Successfully (Mock)');

            // Log trade locally
            const logEntry = {
                timestamp: new Date().toISOString(),
                exchange: 'bybit',
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
        } else {
            console.error('Bybit Error:', mockResponse.retMsg);
        }

    } catch (error) {
        console.error("Pipeline Error:", error);
        process.exit(1);
    }
}

executeTrade();
