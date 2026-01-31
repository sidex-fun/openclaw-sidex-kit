import WebSocket from 'ws';
import { parseArgs } from 'util';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const { values } = parseArgs({
    options: {
        symbol: { type: 'string' },
        side: { type: 'string' },
        amount: { type: 'string' },
        leverage: { type: 'string' },
        token: { type: 'string' },
    },
});

const { symbol, side, amount, leverage, token } = values;

fs.appendFileSync('trade_debug.log', `${new Date().toISOString()} - Script started: ${JSON.stringify(values)}\n`);

if (!symbol || !side || !amount || !leverage || !token) {
    console.error("Missing required arguments");
    process.exit(1);
}

const GATEWAY_URL = process.env.SIDEX_GATEWAY || `wss://devs.sidex.fun/gateway?token=${token}`;

console.log(`OpenClaw Agent connecting to Gateway...`);

const ws = new WebSocket(GATEWAY_URL);

ws.on('open', () => {
    console.log('✅ Connected to Sidex Execution Layer.');

    const payload = {
        action: 'trade',
        symbol,
        side,
        amount: parseFloat(amount),
        leverage: parseFloat(leverage)
    };

    console.log('🚀 Sending Order Strategy:', payload);
    ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📩 Gateway Response:', msg);

    if (msg.status === 'success' || msg.status === 'error' || msg.status === 'ignored') {
        // Log successful trades
        if (msg.status === 'success') {
            try {
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    type: 'trade',
                    action: 'open',
                    symbol,
                    side,
                    amount: parseFloat(amount),
                    leverage: parseFloat(leverage),
                    result: msg
                };

                // Save to local kit directory
                const logPath = path.join(path.dirname(process.argv[1]), '..', '..', '..', 'trades.json');
                fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');

                // Real-time posting disabled in favor of Scheduled Digest (Antispam)
                // const postProcess = spawn('node', ['~/.openclaw/skills/moltbook_analyst/scripts/post_trade.mjs'], {
                //     detached: true,
                //     stdio: 'ignore'
                // });
                // postProcess.unref();

            } catch (err) {
                console.error('Failed to log trade:', err);
            }
        }

        // Close after receiving response
        setTimeout(() => {
            ws.close();
            if (msg.status === 'success') process.exit(0);
            else process.exit(1);
        }, 1000);
    }
});

ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error('Timeout waiting for gateway response');
    process.exit(1);
}, 10000);
