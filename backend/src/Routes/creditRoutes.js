const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const { protect, isRetailer, isWholesaler } = require('../middleware/MiddlewareAuth');

// Helper function to create invoice
async function createInvoice(order_id, retailer_id, wholesaler_id, amount = null) {
    try {
        // Get order details
        const [order] = await db.query(`
            SELECT o.*, r.store_name as retailer_name, w.business_name as wholesaler_name
            FROM orders o
            JOIN retailers r ON o.retailer_id = r.retailer_id
            JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
            WHERE o.order_id = ?
        `, [order_id]);

        if (order.length === 0) return null;

        // Get order items
        const [items] = await db.query(`
            SELECT product_name, quantity, unit_price, total_price
            FROM order_items
            WHERE order_id = ?
        `, [order_id]);

        // Generate invoice number
        const [count] = await db.query('SELECT COUNT(*) as count FROM invoices');
        const invoiceNumber = `INV-${Date.now()}-${count[0].count + 1}`;

        // Calculate due date (30 days from now)
        const issueDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // Create invoice
        const [result] = await db.query(`
            INSERT INTO invoices 
            (invoice_number, order_id, retailer_id, wholesaler_id, total_amount, 
             status, payment_terms, issue_date, due_date)
            VALUES (?, ?, ?, ?, ?, 'sent', 'net_30', ?, ?)
        `, [invoiceNumber, order_id, retailer_id, wholesaler_id, order[0].total_amount, issueDate, dueDate]);

        const invoice_id = result.insertId;

        // Add invoice items
        for (const item of items) {
            await db.query(`
                INSERT INTO invoice_items (invoice_id, product_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `, [invoice_id, item.product_name, item.quantity, item.unit_price, item.total_price]);
        }

        return invoice_id;
    } catch (error) {
        console.error('Create invoice error:', error);
        return null;
    }
}

// ============================================
// RETAILER: REQUEST CREDIT
// ============================================
router.post('/request', protect, isRetailer, async (req, res) => {
    const { wholesaler_id, amount, order_id } = req.body;
    const retailer_id = req.user.id;

    if (!wholesaler_id || !amount) {
        return res.status(400).json({ message: 'Wholesaler ID and amount are required' });
    }

    try {
        // Check if credit profile exists
        let [profile] = await db.query(`
            SELECT * FROM credit_profiles 
            WHERE retailer_id = ? AND wholesaler_id = ?
        `, [retailer_id, wholesaler_id]);

        if (profile.length === 0) {
            // Auto-create a default credit profile (manual review needed)
            await db.query(`
                INSERT INTO credit_profiles (retailer_id, wholesaler_id, credit_limit)
                VALUES (?, ?, 50000)
            `, [retailer_id, wholesaler_id]);

            [profile] = await db.query(`
                SELECT * FROM credit_profiles 
                WHERE retailer_id = ? AND wholesaler_id = ?
            `, [retailer_id, wholesaler_id]);
        }

        // Create credit request
        const [result] = await db.query(`
            INSERT INTO credit_requests (retailer_id, wholesaler_id, amount, order_id, status)
            VALUES (?, ?, ?, ?, 'pending')
        `, [retailer_id, wholesaler_id, amount, order_id || null]);

        res.status(201).json({
            success: true,
            request_id: result.insertId,
            message: 'Credit request sent to wholesaler for approval'
        });

    } catch (error) {
        console.error('Credit request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// WHOLESALER: GET PENDING CREDIT REQUESTS
// ============================================
router.get('/requests/pending', protect, isWholesaler, async (req, res) => {
    const wholesaler_id = req.user.id;

    try {
        const [requests] = await db.query(`
            SELECT cr.*, r.store_name as retailer_name, r.email as retailer_email,
                   o.order_number
            FROM credit_requests cr
            JOIN retailers r ON cr.retailer_id = r.retailer_id
            LEFT JOIN orders o ON cr.order_id = o.order_id
            WHERE cr.wholesaler_id = ? AND cr.status = 'pending'
            ORDER BY cr.created_at ASC
        `, [wholesaler_id]);

        res.json(requests);
    } catch (error) {
        console.error('Get credit requests error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// WHOLESALER: APPROVE/REJECT CREDIT REQUEST
// ============================================
router.put('/requests/:request_id', protect, isWholesaler, async (req, res) => {
    const { request_id } = req.params;
    const { status, credit_limit } = req.body;
    const wholesaler_id = req.user.id;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        // Get the request
        const [request] = await db.query(`
            SELECT * FROM credit_requests 
            WHERE request_id = ? AND wholesaler_id = ?
        `, [request_id, wholesaler_id]);

        if (request.length === 0) {
            return res.status(404).json({ message: 'Credit request not found' });
        }

        // Update request status
        await db.query(`
            UPDATE credit_requests 
            SET status = ?, reviewed_at = NOW()
            WHERE request_id = ?
        `, [status, request_id]);

        if (status === 'approved') {
            // Update or create credit profile
            await db.query(`
                INSERT INTO credit_profiles (retailer_id, wholesaler_id, credit_limit)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                credit_limit = VALUES(credit_limit), is_active = TRUE
            `, [request[0].retailer_id, wholesaler_id, credit_limit || 50000]);

            // If there's an order associated, create invoice
            if (request[0].order_id) {
                await createInvoice(request[0].order_id, request[0].retailer_id, wholesaler_id);
            }
        }

        res.json({
            success: true,
            message: `Credit request ${status}`
        });

    } catch (error) {
        console.error('Update credit request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// RETAILER: GET CREDIT PROFILE
// ============================================
router.get('/profile', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [profiles] = await db.query(`
            SELECT cp.*, w.business_name as wholesaler_name
            FROM credit_profiles cp
            JOIN wholesalers w ON cp.wholesaler_id = w.wholesaler_id
            WHERE cp.retailer_id = ? AND cp.is_active = TRUE
        `, [retailer_id]);

        res.json(profiles);
    } catch (error) {
        console.error('Get credit profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// RETAILER: MAKE CREDIT PAYMENT
// ============================================
router.post('/pay', protect, isRetailer, async (req, res) => {
    const { wholesaler_id, amount, payment_method } = req.body;
    const retailer_id = req.user.id;

    try {
        // Update used credit
        await db.query(`
            UPDATE credit_profiles 
            SET used_credit = used_credit - ?
            WHERE retailer_id = ? AND wholesaler_id = ?
        `, [amount, retailer_id, wholesaler_id]);

        // Log transaction
        await db.query(`
            INSERT INTO credit_transactions (retailer_id, wholesaler_id, amount, type, description)
            VALUES (?, ?, ?, 'payment', ?)
        `, [retailer_id, wholesaler_id, amount, `Payment via ${payment_method}`]);

        res.json({ success: true, message: 'Payment recorded successfully' });
    } catch (error) {
        console.error('Credit payment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// WHOLESALER: APPROVE CREDIT ORDER
// ============================================
router.put('/orders/:order_id/approve', protect, isWholesaler, async (req, res) => {
    const { order_id } = req.params;
    const wholesaler_id = req.user.id;

    try {
        // Get order to know retailer_id and amount
        const [order] = await db.query(`
            SELECT retailer_id, total_amount FROM orders WHERE order_id = ?
        `, [order_id]);

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await db.query(`
            UPDATE orders 
            SET payment_status = 'credit_approved', 
                status = 'confirmed',
                updated_at = NOW()
            WHERE order_id = ? AND wholesaler_id = ?
        `, [order_id, wholesaler_id]);

        // ✅ Generate invoice for the credit order
        const invoiceId = await createInvoice(order_id, order[0].retailer_id, wholesaler_id, order[0].total_amount);

        res.json({
            success: true,
            message: 'Credit approved. Invoice generated.',
            invoice_id: invoiceId
        });
    } catch (error) {
        console.error('Approve credit error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// WHOLESALER: DENY CREDIT ORDER
// ============================================
router.put('/orders/:order_id/deny', protect, isWholesaler, async (req, res) => {
    const { order_id } = req.params;
    const wholesaler_id = req.user.id;

    try {
        await db.query(`
            UPDATE orders 
            SET payment_status = 'credit_denied', 
                status = 'cancelled',
                updated_at = NOW()
            WHERE order_id = ? AND wholesaler_id = ?
        `, [order_id, wholesaler_id]);

        res.json({ success: true, message: 'Credit denied' });
    } catch (error) {
        console.error('Deny credit error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// WHOLESALER: GET INVOICES
// ============================================
router.get('/invoices', protect, isWholesaler, async (req, res) => {
    const wholesaler_id = req.user.id;
    const { status } = req.query;

    try {
        let query = `
            SELECT i.*, r.store_name as retailer_name
            FROM invoices i
            JOIN retailers r ON i.retailer_id = r.retailer_id
            WHERE i.wholesaler_id = ?
        `;
        const params = [wholesaler_id];

        if (status) {
            query += ` AND i.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY i.due_date ASC`;

        const [invoices] = await db.query(query, params);
        res.json(invoices);
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// RETAILER: GET INVOICES
// ============================================
router.get('/my-invoices', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [invoices] = await db.query(`
            SELECT i.*, w.business_name as wholesaler_name
            FROM invoices i
            JOIN wholesalers w ON i.wholesaler_id = w.wholesaler_id
            WHERE i.retailer_id = ?
            ORDER BY i.due_date ASC
        `, [retailer_id]);

        res.json(invoices);
    } catch (error) {
        console.error('Get my invoices error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET INVOICE BY ID
// ============================================
router.get('/invoices/:invoice_id', protect, async (req, res) => {
    const { invoice_id } = req.params;
    const user_id = req.user.id;
    const userType = req.user.userType;

    try {
        let query = `
            SELECT i.*, 
                   r.store_name as retailer_name, r.email as retailer_email, r.phone as retailer_phone, r.address as retailer_address,
                   w.business_name as wholesaler_name, w.email as wholesaler_email, w.phone as wholesaler_phone
            FROM invoices i
            JOIN retailers r ON i.retailer_id = r.retailer_id
            JOIN wholesalers w ON i.wholesaler_id = w.wholesaler_id
            WHERE i.invoice_id = ?
        `;

        if (userType === 'retailer') {
            query += ` AND i.retailer_id = ?`;
        } else if (userType === 'wholesaler') {
            query += ` AND i.wholesaler_id = ?`;
        }

        const params = userType === 'retailer' ? [invoice_id, user_id] : [invoice_id, user_id];
        const [invoice] = await db.query(query, params);

        if (invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Get invoice items
        const [items] = await db.query(`
            SELECT * FROM invoice_items WHERE invoice_id = ?
        `, [invoice_id]);

        res.json({ ...invoice[0], items });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// MARK INVOICE AS PAID
// ============================================
router.put('/invoices/:invoice_id/pay', protect, isRetailer, async (req, res) => {
    const { invoice_id } = req.params;
    const retailer_id = req.user.id;

    try {
        await db.query(`
            UPDATE invoices 
            SET status = 'paid', 
                amount_paid = total_amount,
                paid_at = NOW()
            WHERE invoice_id = ? AND retailer_id = ?
        `, [invoice_id, retailer_id]);

        // Also update credit profile
        const [invoice] = await db.query(`
            SELECT wholesaler_id, total_amount FROM invoices WHERE invoice_id = ?
        `, [invoice_id]);

        if (invoice.length > 0) {
            await db.query(`
                UPDATE credit_profiles 
                SET used_credit = used_credit - ?
                WHERE retailer_id = ? AND wholesaler_id = ?
            `, [invoice[0].total_amount, retailer_id, invoice[0].wholesaler_id]);
        }

        res.json({ success: true, message: 'Invoice marked as paid' });
    } catch (error) {
        console.error('Pay invoice error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET CREDIT SCORE HISTORY (for chart)
// ============================================
router.get('/score-history', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        // Try to get credit score history from credit_profiles
        const [history] = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m-%d') as date,
                credit_score
            FROM credit_profiles
            WHERE retailer_id = ?
            ORDER BY created_at ASC
            LIMIT 30
        `, [retailer_id]);

        if (history.length === 0) {
            // No history found, return default/generated history
            const defaultHistory = [];
            const today = new Date();
            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(today.getMonth() - i);
                const score = 500 + (5 - i) * 10;
                defaultHistory.push({
                    date: date.toISOString().split('T')[0],
                    credit_score: score
                });
            }
            return res.json(defaultHistory);
        }

        // Transform data for chart
        const chartData = history.map(item => ({
            date: item.date,
            score: item.credit_score
        }));

        res.json(chartData);
    } catch (error) {
        console.error('Get credit score history error:', error);
        // Return mock data on error
        const mockHistory = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(today.getMonth() - i);
            mockHistory.push({
                date: date.toISOString().split('T')[0],
                score: 500 + (5 - i) * 10
            });
        }
        res.json(mockHistory);
    }
});

// ============================================
// GET CREDIT TRANSACTION HISTORY
// ============================================
router.get('/history', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [transactions] = await db.query(`
            SELECT ct.*, w.business_name as wholesaler_name
            FROM credit_transactions ct
            JOIN wholesalers w ON ct.wholesaler_id = w.wholesaler_id
            WHERE ct.retailer_id = ?
            ORDER BY ct.created_at DESC
            LIMIT 50
        `, [retailer_id]);

        res.json(transactions);
    } catch (error) {
        console.error('Get credit history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;