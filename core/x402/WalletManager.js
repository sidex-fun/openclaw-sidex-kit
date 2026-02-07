import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, polygon } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Manages the agent's on-chain identity and wallet.
 */
export class WalletManager {
    constructor(chainName = 'base') {
        this.privateKey = process.env.EVM_PRIVATE_KEY;
        this.rpcUrl = process.env.EVM_RPC_URL // Allow override, otherwise defaults based on chain

        // Select chain based on input
        if (chainName === 'polygon') {
            this.chain = polygon;
            // Default Polygon RPC if not provided in env for general override
            if (!this.rpcUrl) this.rpcUrl = 'https://polygon-rpc.com';
        } else {
            this.chain = base; // Default to Base
            if (!this.rpcUrl) this.rpcUrl = 'https://mainnet.base.org';
        }

        if (!this.privateKey) {
            console.warn('⚠️ No EVM_PRIVATE_KEY found in .env. x402 features will be disabled.');
            this.client = null;
            this.account = null;
            return;
        }

        try {
            this.account = privateKeyToAccount(this.privateKey);
            this.client = createWalletClient({
                account: this.account,
                chain: this.chain,
                transport: http(this.rpcUrl)
            }).extend(publicActions);

            console.log(`✅ Wallet initialized: ${this.account.address} on ${this.chain.name}`);
        } catch (error) {
            console.error('❌ Failed to initialize wallet:', error.message);
            this.client = null;
        }
    }

    /**
     * returns the wallet address
     */
    getAddress() {
        return this.account ? this.account.address : null;
    }

    /**
     * Signs a message (useful for auth)
     * @param {string} message 
     */
    async signMessage(message) {
        if (!this.client) throw new Error('Wallet not initialized');
        return await this.client.signMessage({ message });
    }

    /**
     * Sends a transaction to pay for a resource
     * @param {string} to - Recipient address
     * @param {bigint} value - Amount in wei
     * @param {object} data - Optional data payload
     */
    async sendPayment(to, value, data = '0x') {
        if (!this.client) throw new Error('Wallet not initialized');

        console.log(`💸 Sending ${value.toString()} wei to ${to}...`);

        const hash = await this.client.sendTransaction({
            to,
            value,
            data
        });

        console.log(`Processing Transaction: ${hash}`);
        // Wait for confirmation
        const receipt = await this.client.waitForTransactionReceipt({ hash });

        console.log(`✅ Transaction Confirmed: ${receipt.transactionHash}`);
        return receipt.transactionHash;
    }
}
