import { X402Client } from '../../core/index.js';

async function run() {
    console.log("🚀 Starting Market Intelligence Pipeline...");

    const client = new X402Client();

    // Example URL of a service that charges for predictions
    // In a real scenario, this would be a live endpoint returning 402
    const TARGET_URL = 'https://api.market-guru.example.com/prediction/btc-usd';

    try {
        const response = await client.fetch(TARGET_URL);

        if (response.ok) {
            const data = await response.json();
            console.log("✅ Received Intelligence:", data);
        } else {
            console.log(`⚠️ Failed to get intelligence. Status: ${response.status}`);
            if (response.status === 402) {
                console.log("💡 Tip: Ensure your wallet has funds and the .env is configured.");
            }
        }
    } catch (error) {
        console.error("Pipeline Error:", error);
    }
}

run();
