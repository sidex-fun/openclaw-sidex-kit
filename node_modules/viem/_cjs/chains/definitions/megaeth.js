"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.megaeth = void 0;
const defineChain_js_1 = require("../../utils/chain/defineChain.js");
exports.megaeth = (0, defineChain_js_1.defineChain)({
    id: 4326,
    blockTime: 1_000,
    name: 'MegaETH',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://mainnet.megaeth.com/rpc'],
            webSocket: ['wss://mainnet.megaeth.com/ws'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Blockscout',
            url: 'https://megaeth.blockscout.com',
            apiUrl: 'https://megaeth.blockscout.com/api',
        },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
        },
    },
});
//# sourceMappingURL=megaeth.js.map