console.log(' Payment routes loaded - /mpesa/stkpush endpoint registered');
const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const { protect, isRetailer } = require('../middleware/MiddlewareAuth');
const mpesaService = require('../services/mpesaService');

// ============================================
// INITIATE M-PESA PAYMENT
// ============================================
router.post('/mpesa/stkpush', protect, isRetailer, async (req, res) => {
    const { order_id, amount, phone_number } = req.body;
    const retailer_id = req.user.id;

    if (!order_id || !amount || !phone_number) {
        return res.status(400).json({ message: 'Order ID, amount, and phone number are required' });
    }

    try {
        // Verify order belongs to this retailer
        const [order] = await db.query(
            'SELECT * FROM orders WHERE order_id = ? AND retailer_id = ?',
            [order_id, retailer_id]
        );

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Create payment record with meaningful merchant_request_id containing order_id
        const accountReference = `ORDER-${order_id}`;
        const merchantRequestId = `${accountReference}-${Date.now()}`;
        const transactionDesc = `Payment for order #${order[0].order_number}`;

        // Initiate STK Push
        const mpesaResponse = await mpesaService.stkPush(
            phone_number,
            amount,
            accountReference,
            transactionDesc
        );

        // Store transaction details in database
        await db.query(`
            INSERT INTO payment_transactions 
            (order_id, payment_method, amount, payment_status, merchant_request_id, checkout_request_id, phone_number)
            VALUES (?, 'mpesa', ?, 'pending', ?, ?, ?)
        `, [order_id, amount, merchantRequestId, mpesaResponse.CheckoutRequestID, phone_number]);

        res.json({
            success: true,
            message: 'STK Push sent. Please check your phone.',
            checkoutRequestID: mpesaResponse.CheckoutRequestID,
            merchantRequestID: merchantRequestId
        });

    } catch (error) {
        console.error('M-Pesa STK Push error:', error);
        res.status(500).json({ message: error.message || 'Payment initiation failed' });
    }
});

// ============================================
// M-PESA CALLBACK URL (Safaricom sends response here)
// ============================================
router.post('/mpesa/callback', async (req, res) => {
    console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

    try {
        const { Body } = req.body;
        const { stkCallback } = Body;

        const {
            MerchantRequestID,
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = stkCallback;

        // Try to find existing transaction
        let [transaction] = await db.query(
            'SELECT * FROM payment_transactions WHERE checkout_request_id = ?',
            [CheckoutRequestID]
        );

        let order_id = null;

        // If transaction doesn't exist, create one (for 1037 cases)
        if (transaction.length === 0) {
            console.log('Transaction not found. Creating from callback data...');

            // Extract order_id from MerchantRequestID (format: ORDER-123-1234567890)
            const orderIdMatch = MerchantRequestID.match(/ORDER-(\d+)/);
            if (orderIdMatch) {
                order_id = parseInt(orderIdMatch[1]);
                console.log(`Extracted order_id ${order_id} from MerchantRequestID`);
            } else {
                // Create a new order for this failed transaction
                console.log('Creating new failed order record...');
                const [orderResult] = await db.query(`
                    INSERT INTO orders 
                    (order_number, retailer_id, wholesaler_id, total_amount, status, payment_status, created_at)
                    VALUES (?, 1, 1, 0, 'cancelled', 'failed', NOW())
                `, [`FAILED-${CheckoutRequestID}`]);
                order_id = orderResult.insertId;
            }

            // Create transaction record for the failed payment
            await db.query(`
                INSERT INTO payment_transactions 
                (order_id, payment_method, amount, payment_status, checkout_request_id, merchant_request_id, phone_number, created_at)
                VALUES (?, 'mpesa', 0, 'failed', ?, ?, 'unknown', NOW())
            `, [order_id, CheckoutRequestID, MerchantRequestID]);

            [transaction] = await db.query(
                'SELECT * FROM payment_transactions WHERE checkout_request_id = ?',
                [CheckoutRequestID]
            );
        }

        order_id = transaction[0].order_id;

        if (ResultCode === 0) {
            // Payment successful
            let amount = 0;
            let mpesaReceiptNumber = '';
            let transactionDate = '';

            if (CallbackMetadata && CallbackMetadata.Item) {
                for (const item of CallbackMetadata.Item) {
                    if (item.Name === 'Amount') amount = item.Value;
                    if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
                    if (item.Name === 'TransactionDate') transactionDate = item.Value;
                }
            }

            // Update payment transaction
            await db.query(`
                UPDATE payment_transactions 
                SET payment_status = 'completed', 
                    amount = ?,
                    mpesa_result_code = ?, 
                    mpesa_result_desc = ?,
                    mpesa_callback_data = ?,
                    mpesa_receipt_number = ?,
                    updated_at = NOW()
                WHERE checkout_request_id = ?
            `, [amount, ResultCode, ResultDesc, JSON.stringify(req.body), mpesaReceiptNumber, CheckoutRequestID]);

            // Update order status
            await db.query(`
                UPDATE orders 
                SET payment_status = 'paid', 
                    paid_at = NOW(),
                    status = 'processing'
                WHERE order_id = ?
            `, [order_id]);

            console.log(`✅ Payment successful for order ${order_id}. Receipt: ${mpesaReceiptNumber}`);

        } else {
            // Payment failed (including 1037 timeout)
            await db.query(`
                UPDATE payment_transactions 
                SET payment_status = 'failed', 
                    mpesa_result_code = ?, 
                    mpesa_result_desc = ?,
                    mpesa_callback_data = ?
                WHERE checkout_request_id = ?
            `, [ResultCode, ResultDesc, JSON.stringify(req.body), CheckoutRequestID]);

            // Update order status to failed/cancelled
            await db.query(`
                UPDATE orders 
                SET payment_status = 'failed',
                    status = 'cancelled'
                WHERE order_id = ?
            `, [order_id]);

            console.log(`❌ Payment failed for order ${order_id}: ${ResultDesc} (Code: ${ResultCode})`);
        }

        // Always respond with success to Safaricom
        res.json({ ResultCode: 0, ResultDesc: 'Success' });

    } catch (error) {
        console.error('Callback processing error:', error);
        res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }
});

// ============================================
// CHECK PAYMENT STATUS
// ============================================
router.get('/status/:order_id', protect, isRetailer, async (req, res) => {
    const { order_id } = req.params;
    const retailer_id = req.user.id;

    try {
        const [payment] = await db.query(`
            SELECT payment_status, mpesa_result_code as result_code, mpesa_result_desc as result_description, 
                   mpesa_receipt_number, created_at
            FROM payment_transactions
            WHERE order_id = ?
            ORDER BY transaction_id DESC
            LIMIT 1
        `, [order_id]);

        res.json(payment[0] || { payment_status: 'not_found' });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// CARD PAYMENT (placeholder - integrate Stripe/Pesapal)
// ============================================
router.post('/card/pay', protect, isRetailer, async (req, res) => {
    const { order_id, amount, card_details } = req.body;

    try {
        // This is where you'd integrate Stripe or Pesapal
        // For now, return success for testing

        console.log(`Card payment for order ${order_id}: KES ${amount}`);

        await db.query(`
            UPDATE orders SET payment_status = 'paid', paid_at = NOW()
            WHERE order_id = ?
        `, [order_id]);

        res.json({
            success: true,
            message: 'Payment successful',
            transaction_id: 'CARD-' + Date.now()
        });
    } catch (error) {
        console.error('Card payment error:', error);
        res.status(500).json({ message: 'Payment failed' });
    }
});

// ============================================
// GET PAYMENT METHODS CONFIGURATION
// ============================================
router.get('/config', async (req, res) => {
    try {
        // Check if payment_settings table exists, if not, return default config
        const [tables] = await db.query(`
            SELECT COUNT(*) as count FROM information_schema.tables 
            WHERE table_schema = DATABASE() AND table_name = 'payment_settings'
        `);

        let paymentConfig = {
            mpesa_enabled: true,
            card_enabled: true,
            credit_enabled: true,
            bank_transfer_enabled: false
        };

        if (tables[0].count > 0) {
            const [config] = await db.query(`SELECT setting_key, setting_value FROM payment_settings`);
            for (const item of config) {
                if (item.setting_key === 'mpesa_enabled') paymentConfig.mpesa_enabled = item.setting_value === '1';
                if (item.setting_key === 'card_enabled') paymentConfig.card_enabled = item.setting_value === '1';
                if (item.setting_key === 'credit_enabled') paymentConfig.credit_enabled = item.setting_value === '1';
                if (item.setting_key === 'bank_transfer_enabled') paymentConfig.bank_transfer_enabled = item.setting_value === '1';
            }
        }

        res.json(paymentConfig);
    } catch (error) {
        console.error('Get payment config error:', error);
        res.json({
            mpesa_enabled: true,
            card_enabled: true,
            credit_enabled: true,
            bank_transfer_enabled: false
        });
    }
});

module.exports = router;