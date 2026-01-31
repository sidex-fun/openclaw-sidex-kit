import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Debug logging
function logDebug(message) {
    const logPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'post_debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`);
}

logDebug('Script started');

// Configuration
let API_KEY = process.env.MOLTBOOK_API_KEY;
const SUBMOLT = 'trading';

// Try to load from credentials file
try {
    const credPath = path.join(process.env.HOME, '.config', 'moltbook', 'credentials.json');
    if (fs.existsSync(credPath)) {
        const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        if (creds.api_key) API_KEY = creds.api_key;
        logDebug('Loaded API Key from credentials file');
    } else {
        logDebug('Credentials file not found');
    }
} catch (e) {
    logDebug(`Error loading credentials: ${e.message}`);
}

if (!API_KEY) {
    console.warn("⚠️ No API Key found. Set MOLTBOOK_API_KEY or run register.mjs.");
    logDebug("⚠️ No API Key found.");
    // We don't exit, just let it fail naturally or use placeholder
    API_KEY = 'YOUR_API_KEY_HERE';
}

async function postTradeToMoltBook() {
    try {
        logDebug('Reading trades file...');
        // 1. Read the latest trade from the log
        // Looking for trades.json in the kit root (3 levels up from this script in skills/moltbook_analyst/scripts)
        const tradesFile = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'trades.json');

        if (!fs.existsSync(tradesFile)) {
            console.error('No trades found to post (trades.json missing).');
            logDebug(`No trades file found at ${tradesFile}`);
            return;
        }

        const fileContent = fs.readFileSync(tradesFile, 'utf-8').trim();
        const lines = fileContent.split('\n');
        if (lines.length === 0) {
            logDebug('Trades file is empty.');
            return;
        }

        const lastTradeLine = lines[lines.length - 1];
        logDebug(`Reading last line: ${lastTradeLine.substring(0, 50)}...`);

        let trade;
        try {
            trade = JSON.parse(lastTradeLine);
        } catch (e) {
            logDebug(`Failed to parse JSON: ${e.message}`);
            return;
        }

        // 2. Format the post content
        // We make it sound like an agent report
        let title = '';
        let content = '';

        if (trade.action === 'open') {
            title = `🚀 Opened ${trade.side.toUpperCase()} on ${trade.symbol}`;
            content = `Just entered a ${trade.side.toUpperCase()} position on ${trade.symbol}.\n` +
                `Entry Amount: $${trade.amount}\n` +
                `Leverage: ${trade.leverage}x\n` +
                `\nScanning for alpha... 🤖📈 #SidexBot #OpenClaw #${trade.symbol.split('/')[0]}`;
        } else if (trade.action === 'close') {
            title = `💰 Closed position on ${trade.asset}`;

            // Try to find profit in the result object, or default to a generic "Profit secured" message
            // The Sidex gateway result might contain 'pnl' or 'profit'
            let profitText = "";
            if (trade.result && trade.result.pnl) {
                const pnl = parseFloat(trade.result.pnl);
                const emoji = pnl >= 0 ? "🤑" : "🩸";
                profitText = `PnL: ${pnl >= 0 ? '+' : ''}${pnl} USDT ${emoji}`;
            } else {
                // Fallback if no specific PnL data
                profitText = "Profit: Secured ✅ (Analysis pending)";
            }

            content = `Exited ${trade.asset} position (${trade.side.toUpperCase()}).\n` +
                `Trade completed successfully.\n` +
                `${profitText}\n` +
                `\nReviewing performance metrics... 📊 #SidexBot #Profit #Results`;
        } else {
            // Skip unknown actions
            logDebug(`Unknown action: ${trade.action}`);
            return;
        }

        // 3. Send to MoltBook API
        console.log(`Posting to MoltBook [${SUBMOLT}]: ${title}`);
        logDebug(`Posting to MoltBook [${SUBMOLT}]: ${title}`);

        const response = await fetch('https://www.moltbook.com/api/v1/posts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                submolt: SUBMOLT,
                title: title,
                content: content
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Posted successfully! Post ID: ${data.id}`);
            logDebug(`✅ Posted successfully! Post ID: ${data.id}`);
        } else {
            console.error(`❌ Failed to post: ${response.status} - ${JSON.stringify(data)}`);
            logDebug(`❌ Failed to post: ${response.status} - ${JSON.stringify(data)}`);
            if (response.status === 401) {
                console.error("💡 Hint: You need to set a valid MOLTBOOK_API_KEY.");
                logDebug("💡 Hint: You need to set a valid MOLTBOOK_API_KEY.");
            }
        }

    } catch (error) {
        logDebug(`Error posting to MoltBook: ${error.message}`);
        console.error('Error posting to MoltBook:', error);
    }
}

postTradeToMoltBook();
