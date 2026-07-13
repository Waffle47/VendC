const axios = require('axios');

class PayHeroService {
    constructor() {
        this.apiUsername = process.env.PAYHERO_API_USERNAME;
        this.apiPassword = process.env.PAYHERO_API_PASSWORD;
        this.authToken = process.env.PAYHERO_AUTH_TOKEN;
        this.channelId = process.env.PAYHERO_CHANNEL_ID;
        this.callbackUrl = process.env.PAYHERO_CALLBACK_URL;

        // Use the correct base URL for test environment
        this.baseURL = 'https://test.pay.hero.io';  // For testing

        // WHEN MOVING TO PRODUCTION, SWITCH TO:
        // this.baseURL = 'https://pay.hero.io';
    }

    // Initiate STK Push Payment
    async initiateSTKPush(amount, phoneNumber, externalReference, customerName = '') {
        try {
            const response = await axios.post(
                `${this.baseURL}/stkpush`, // Confirm exact endpoint with PayHero
                {
                    amount: amount,
                    phone: phoneNumber,
                    channel_id: this.channelId,
                    external_reference: externalReference,
                    callback_url: this.callbackUrl,
                    customer_name: customerName
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('PayHero STK Push Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Payment initiation failed');
        }
    }

    // Check Transaction Status
    async checkTransactionStatus(externalReference) {
        try {
            const response = await axios.get(
                `${this.baseURL}/transaction/status`,
                {
                    params: { external_reference: externalReference },
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('PayHero Status Check Error:', error.response?.data || error.message);
            throw new Error('Failed to check transaction status');
        }
    }

    // Check Wallet Balance
    async getWalletBalance() {
        try {
            const response = await axios.get(
                `${this.baseURL}/wallet/balance`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('PayHero Balance Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch wallet balance');
        }
    }
}

module.exports = new PayHeroService();