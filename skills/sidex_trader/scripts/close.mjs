import WebSocket from 'ws';
import fs from 'fs';
import { spawn } from 'child_process';

const asset = process.argv[2] || 'BTC/USDT';
const side = process.argv[3] || 'long';
const TOKEN = process.argv[4] || '6eb563a1e16924bac19689b94de377342d5c6788038d85ad';
const GATEWAY_URL = `ws://127.0.0.1:5001/gateway?token=${TOKEN}`;

console.log(`Closing ${side} position on ${asset}...`);

const ws = new WebSocket(GATEWAY_URL);

ws.on('open', () => {
    console.log('Connected to Gateway.');

    const payload = {
        action: 'close',
        asset: asset,
        side: side
    };

    console.log('Sending Close Command:', payload);
    ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Gateway Response:', msg);

    if (msg.status === 'success' || msg.status === 'error' || msg.status === 'ignored') {
        if (msg.status === 'success') {
            try {
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    type: 'trade',
                    action: 'close',
                    asset: asset,
                    side: side,
                    result: msg
                };
                fs.appendFileSync('/var/www/sidex-trade-bot/trades.json', JSON.stringify(logEntry) + '\n');

                // Real-time posting disabled in favor of Scheduled Digest (Antispam)
                // const postProcess = spawn('node', ...); 

            } catch (err) {
                // Ignore log errors to not break execution, but print
                console.error('Log error:', err);
            }
        }

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

setTimeout(() => {
    console.error('Timeout waiting for gateway response');
    process.exit(1);
}, 10000);
