console.log('Loading orderRoutes.js...');
const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const { protect, isRetailer, isWholesaler } = require('../middleware/MiddlewareAuth');

// ============================================
// CREATE ORDER FROM CART
// ============================================
router.post('/create', protect, isRetailer, async (req, res) => {
    const { items, subtotal, shipping, total, payment_method, payment_status } = req.body;
    const retailer_id = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
    }

    try {
        await db.query('START TRANSACTION');

        const wholesaler_id = items[0].wholesaler_id;

        // Get retailer's shipping address
        const [retailer] = await db.query('SELECT address, store_name FROM retailers WHERE retailer_id = ?', [retailer_id]);
        const shippingAddress = retailer[0]?.address || 'No address provided';

        // Generate order number
        const [countResult] = await db.query('SELECT COUNT(*) as count FROM orders');
        const orderNumber = `ORD-${Date.now()}-${countResult[0].count + 1}`;

        //  Create order with payment_method and payment_status
        const [orderResult] = await db.query(`
            INSERT INTO orders 
            (order_number, retailer_id, wholesaler_id, subtotal, shipping_cost, total_amount, 
             status, payment_status, payment_method, shipping_address)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        `, [orderNumber, retailer_id, wholesaler_id, subtotal, shipping, total,
            payment_status || 'unpaid',
            payment_method || 'mpesa',
            shippingAddress]);

        const order_id = orderResult.insertId;

        // Create order items
        for (const item of items) {
            await db.query(`
                INSERT INTO order_items 
                (order_id, product_id, product_name, product_sku, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [order_id, item.product_id, item.product_name, item.sku || 'N/A', item.quantity, item.unit_price, item.quantity * item.unit_price]);
        }

        await db.query('COMMIT');

        res.status(201).json({
            success: true,
            order_id: order_id,
            order_number: orderNumber,
            message: 'Order created successfully'
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Failed to create order' });
    }
});

// ============================================
// GET LOGGED-IN RETAILER'S ORDERS- comes before parameter route
// ============================================
router.get('/my-orders', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [orders] = await db.query(`
            SELECT 
                o.order_id, 
                o.order_number, 
                o.total_amount, 
                o.status, 
                o.payment_status,
                o.ordered_at,  -- ← Changed from created_at to ordered_at
                COUNT(oi.order_item_id) as item_count
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.retailer_id = ?
            GROUP BY o.order_id
            ORDER BY o.ordered_at DESC  -- ← Changed from created_at to ordered_at
        `, [retailer_id]);

        res.json(orders);
    } catch (error) {
        console.error('Get my orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET SINGLE ORDER WITH ITEMS (Parameter route - MUST come AFTER specific routes)
// ============================================
router.get('/:order_id', protect, isRetailer, async (req, res) => {
    const { order_id } = req.params;
    const retailer_id = req.user.id;

    try {
        // Fetch order details
        const [order] = await db.query(`
            SELECT o.*, w.business_name as wholesaler_name
            FROM orders o
            JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
            WHERE o.order_id = ? AND o.retailer_id = ?
        `, [order_id, retailer_id]);

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Fetch order items
        const [items] = await db.query(`
            SELECT * FROM order_items WHERE order_id = ?
        `, [order_id]);

        // Combine and send response
        res.json({ ...order[0], items });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET WHOLESALER'S ORDERS (for wholesaler dashboard)
// ============================================
router.get('/wholesaler/orders', protect, isWholesaler, async (req, res) => {
    const wholesaler_id = req.user.id;

    try {
        const [orders] = await db.query(`
            SELECT 
                o.order_id, 
                o.order_number, 
                o.total_amount, 
                o.status, 
                o.payment_status,
                o.payment_method,  
                o.ordered_at,
                r.store_name as retailer_name,
                r.email as retailer_email,
                r.phone as retailer_phone,
                r.address as retailer_address,
                COUNT(oi.order_item_id) as item_count
            FROM orders o
            JOIN retailers r ON o.retailer_id = r.retailer_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.wholesaler_id = ?
            GROUP BY o.order_id
            ORDER BY o.ordered_at DESC
        `, [wholesaler_id]);

        res.json(orders);
    } catch (error) {
        console.error('Get wholesaler orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// UPDATE ORDER STATUS (wholesaler confirms completion)
// ============================================
router.put('/wholesaler/orders/:order_id/status', protect, isWholesaler, async (req, res) => {
    const { order_id } = req.params;
    const { status } = req.body;
    const wholesaler_id = req.user.id;

    // Allowed status transitions for wholesaler
    const allowedStatuses = ['confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status update' });
    }

    try {
        // Verify order belongs to this wholesaler
        const [order] = await db.query(
            'SELECT * FROM orders WHERE order_id = ? AND wholesaler_id = ?',
            [order_id, wholesaler_id]
        );

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Update the order status
        await db.query(`
            UPDATE orders 
            SET status = ?, 
                updated_at = NOW()
            WHERE order_id = ? AND wholesaler_id = ?
        `, [status, order_id, wholesaler_id]);

        // If marking as delivered, also update delivered_at
        if (status === 'delivered') {
            await db.query(`
                UPDATE orders 
                SET delivered_at = NOW()
                WHERE order_id = ?
            `, [order_id]);
        }

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            status: status
        });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET SINGLE ORDER FOR WHOLESALER (with details)
// ============================================

router.get('/wholesaler/orders/:order_id', protect, isWholesaler, async (req, res) => {
    const { order_id } = req.params;
    const wholesaler_id = req.user.id;

    try {
        const [order] = await db.query(`
            SELECT o.*, r.store_name as retailer_name, r.email as retailer_email, 
                   r.phone as retailer_phone, r.address as retailer_address
            FROM orders o
            JOIN retailers r ON o.retailer_id = r.retailer_id
            WHERE o.order_id = ? AND o.wholesaler_id = ?
        `, [order_id, wholesaler_id]);

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const [items] = await db.query(`
            SELECT * FROM order_items WHERE order_id = ?
        `, [order_id]);

        res.json({ ...order[0], items });
    } catch (error) {
        console.error('Get wholesaler order details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// ============================================
// DEMO: UPDATE ORDER STATUS (for testing)
// ============================================
router.put('/:order_id/status', protect, isRetailer, async (req, res) => {
    const { order_id } = req.params;
    const { payment_status } = req.body;
    const retailer_id = req.user.id;

    try {
        await db.query(`
            UPDATE orders 
            SET payment_status = ?, 
                paid_at = NOW(),
                status = 'processing'
            WHERE order_id = ? AND retailer_id = ?
        `, [payment_status, order_id, retailer_id]);

        res.json({ success: true, message: 'Order status updated' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;