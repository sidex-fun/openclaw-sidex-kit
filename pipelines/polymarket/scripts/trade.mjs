import minimist from 'minimist';
import { PolymarketClient } from './polymarket_client.js';

async function main() {
    const args = minimist(process.argv.slice(2));
    const action = args.action || 'markets';

    console.log('🚀 OpenClaw Polymarket Pipeline');
    console.log('-------------------------------');

    const client = new PolymarketClient();

    try {
        await client.init();

        if (action === 'markets') {
            const limit = args.limit || 5;
            const markets = await client.getMarkets(limit);

            console.log(`\n📋 Top ${markets.length} Active Markets:\n`);
            markets.forEach((m, i) => {
                console.log(`${i + 1}. ${m.question} (ID: ${m.id})`);
                if (m.outcomes) {
                    console.log(`   Outcomes: ${JSON.stringify(m.outcomes)}`);
                }
            });

        } else if (action === 'trade') {
            const marketId = args.market;
            const side = args.side || 'buy';
            const amount = args.amount || 10;
            const outcome = args.outcome || 'YES';

            if (!marketId) {
                console.error('❌ Error: --market=[ID] is required for trading.');
                process.exit(1);
            }

            console.log(`\n💸 Executing Trade: ${side.toUpperCase()} ${amount} USDC on ${outcome}`);

            const result = await client.createOrder(marketId, side, amount, outcome);
            console.log('✅ Trade Result:', result);

        } else {
            console.log('Unknown action. Use --action=markets or --action=trade');
        }

    } catch (error) {
        console.error('❌ Pipeline Error:', error.message);
    }
}

main();
