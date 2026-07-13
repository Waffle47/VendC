const axios = require('axios');

class MpesaService {
    constructor() {
        this.consumerKey = process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
        this.passkey = process.env.MPESA_PASSKEY;
        this.shortcode = process.env.MPESA_SHORTCODE;
        this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

        // FIX: Use correct base URLs
        this.baseURL = this.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';

        //  ADD: For local testing with ngrok
        this.callbackURL = process.env.MPESA_CALLBACK_URL;
    }

    // Get OAuth Token
    async getAccessToken() {
        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

        try {
            const response = await axios.get(
                `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
                {
                    headers: {
                        Authorization: `Basic ${auth}`
                    }
                }
            );
            return response.data.access_token;
        } catch (error) {
            console.error('M-Pesa Token Error:', error.response?.data || error.message);
            throw new Error('Failed to get M-Pesa access token');
        }
    }

    // Generate Timestamp (format: YYYYMMDDHHMMSS)
    getTimestamp() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    // Generate Password (Base64 encoded string)
    generatePassword(timestamp) {
        const str = `${this.shortcode}${this.passkey}${timestamp}`;
        return Buffer.from(str).toString('base64');
    }

    // Format phone number to 254XXXXXXXXX format
    formatPhoneNumber(phoneNumber) {
        let formatted = phoneNumber.toString().trim();

        // Remove any non-digit characters
        formatted = formatted.replace(/\D/g, '');

        // Remove leading 0 if present (0712345678 -> 712345678)
        if (formatted.startsWith('0')) {
            formatted = formatted.substring(1);
        }

        // Remove leading 254 if already present
        if (formatted.startsWith('254')) {
            formatted = formatted.substring(3);
        }

        // Add 254 prefix
        formatted = '254' + formatted;

        return formatted;
    }

    // STK Push (Lipa Na M-Pesa Online)
    async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
        try {
            const token = await this.getAccessToken();
            const timestamp = this.getTimestamp();
            const password = this.generatePassword(timestamp);
            const formattedPhone = this.formatPhoneNumber(phoneNumber);

            console.log('📱 M-Pesa STK Push Request:', {
                phone: formattedPhone,
                amount: amount,
                reference: accountReference,
                timestamp: timestamp
            });

            const requestBody = {
                BusinessShortCode: this.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount),
                PartyA: formattedPhone,
                PartyB: this.shortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: this.callbackURL,
                AccountReference: accountReference,
                TransactionDesc: transactionDesc || 'Payment for order'
            };

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
                requestBody,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(' M-Pesa STK Push Response:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ M-Pesa STK Push Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.errorMessage || 'STK Push failed');
        }
    }

    // Query STK Push Status
    async queryStatus(checkoutRequestID) {
        try {
            const token = await this.getAccessToken();
            const timestamp = this.getTimestamp();
            const password = this.generatePassword(timestamp);

            const requestBody = {
                BusinessShortCode: this.shortcode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            };

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpushquery/v1/query`,
                requestBody,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;

        } catch (error) {
            console.error('❌ M-Pesa Query Error:', error.response?.data || error.message);
            throw new Error('Failed to query payment status');
        }
    }
}

module.exports = new MpesaService();