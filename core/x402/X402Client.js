import fetch from 'node-fetch';
import { WalletManager } from './WalletManager.js';

export class X402Client {
    constructor() {
        this.wallet = new WalletManager();
    }

    /**
     * Performs a fetch request. If a 402 is encountered, attempts to pay and retry.
     * @param {string} url 
     * @param {object} options 
     */
    async fetch(url, options = {}) {
        console.log(`📡 Requesting ${url}...`);

        // request
        let response = await fetch(url, options);

        if (response.status === 402) {
            console.log('🔒 402 Payment Required. Attempting to negotiate via x402...');

            if (!this.wallet.getAddress()) {
                console.error('❌ Wallet not configured. Cannot proceed with payment.');
                return response;
            }

            try {
                // Parse payment requirements
                // We expect the server to return details in the body or headers
                // Example Standard: JSON body with { address, amount, chainId }
                const data = await response.clone().json().catch(() => null);

                let paymentDetails = null;

                if (data && data.payment) {
                    paymentDetails = data.payment;
                } else {
                    // Fallback: Check headers (theoretical implementation)
                    const headerAddress = response.headers.get('x-payment-address');
                    const headerAmount = response.headers.get('x-payment-amount');
                    if (headerAddress && headerAmount) {
                        paymentDetails = { address: headerAddress, amount: headerAmount };
                    }
                }

                if (!paymentDetails) {
                    console.error('❌ Could not parse payment details from 402 response.');
                    return response;
                }

                // Execute Payment
                const txHash = await this.wallet.sendPayment(
                    paymentDetails.address,
                    BigInt(paymentDetails.amount) // Assumes amount is in Wei
                );

                // Retry request with proof of payment
                // 1. By sending the tx hash in a header
                // 2. Or by hitting a /verify endpoint provided in the 402 response (advanced)

                const newHeaders = {
                    ...options.headers,
                    'X-Payment-Hash': txHash,
                    'X-Payer-Address': this.wallet.getAddress()
                };

                console.log('🔄 Retrying request with payment proof...');
                response = await fetch(url, { ...options, headers: newHeaders });

            } catch (err) {
                console.error('❌ Error during x402 payment flow:', err);
            }
        }

        return response;
    }
}
