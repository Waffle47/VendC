const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const { protect, isRetailer } = require('../middleware/MiddlewareAuth');

// ============================================
// GET CART ITEMS
// ============================================
router.get('/', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [cartItems] = await db.query(`
            SELECT c.*, p.name as product_name, p.imageUrl as product_image,
                   p.sku, w.business_name as wholesaler_name
            FROM cart c
            JOIN products p ON c.product_id = p.product_id
            JOIN wholesalers w ON c.wholesaler_id = w.wholesaler_id
            WHERE c.retailer_id = ?
            ORDER BY c.added_at DESC
        `, [retailer_id]);

        res.json(cartItems);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// ADD TO CART
// ============================================
router.post('/add', protect, isRetailer, async (req, res) => {
    const { product_id, quantity, unit_price } = req.body;
    const retailer_id = req.user.id;

    if (!product_id || !quantity || quantity < 1) {
        return res.status(400).json({ message: 'Product ID and valid quantity are required' });
    }

    try {
        // Get product details to verify it exists and get wholesaler_id
        const [product] = await db.query(`
            SELECT product_id, wholesaler_id, base_price, name, stock_quantity
            FROM products 
            WHERE product_id = ? AND status = 'active'
        `, [product_id]);

        if (product.length === 0) {
            return res.status(404).json({ message: 'Product not found or inactive' });
        }

        // Check stock availability
        if (product[0].stock_quantity < quantity) {
            return res.status(400).json({
                message: `Only ${product[0].stock_quantity} units available`
            });
        }

        const finalPrice = unit_price || product[0].base_price;

        // Check if item already exists in cart
        const [existing] = await db.query(
            'SELECT cart_id, quantity FROM cart WHERE retailer_id = ? AND product_id = ?',
            [retailer_id, product_id]
        );

        if (existing.length > 0) {
            // Update existing cart item
            const newQuantity = existing[0].quantity + quantity;

            await db.query(
                'UPDATE cart SET quantity = ?, updated_at = NOW() WHERE cart_id = ?',
                [newQuantity, existing[0].cart_id]
            );

            res.json({
                success: true,
                message: `Updated ${product[0].name} quantity to ${newQuantity}`
            });
        } else {
            // Add new cart item
            await db.query(`
                INSERT INTO cart (retailer_id, product_id, wholesaler_id, quantity, unit_price)
                VALUES (?, ?, ?, ?, ?)
            `, [retailer_id, product_id, product[0].wholesaler_id, quantity, finalPrice]);

            res.json({
                success: true,
                message: `${product[0].name} added to cart`
            });
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// UPDATE CART ITEM QUANTITY
// ============================================
router.put('/update/:cart_id', protect, isRetailer, async (req, res) => {
    const { cart_id } = req.params;
    const { quantity } = req.body;
    const retailer_id = req.user.id;

    if (!quantity || quantity < 1) {
        return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    try {
        // Verify cart item belongs to this retailer
        const [cartItem] = await db.query(
            'SELECT c.*, p.stock_quantity FROM cart c JOIN products p ON c.product_id = p.product_id WHERE c.cart_id = ? AND c.retailer_id = ?',
            [cart_id, retailer_id]
        );

        if (cartItem.length === 0) {
            return res.status(404).json({ message: 'Cart item not found' });
        }

        // Check stock
        if (cartItem[0].stock_quantity < quantity) {
            return res.status(400).json({
                message: `Only ${cartItem[0].stock_quantity} units available`
            });
        }

        await db.query(
            'UPDATE cart SET quantity = ?, updated_at = NOW() WHERE cart_id = ?',
            [quantity, cart_id]
        );

        res.json({ success: true, message: 'Quantity updated' });
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// REMOVE FROM CART
// ============================================
router.delete('/remove/:cart_id', protect, isRetailer, async (req, res) => {
    const { cart_id } = req.params;
    const retailer_id = req.user.id;

    try {
        await db.query(
            'DELETE FROM cart WHERE cart_id = ? AND retailer_id = ?',
            [cart_id, retailer_id]
        );

        res.json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// CLEAR CART (after checkout)
// ============================================
router.delete('/clear', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        await db.query('DELETE FROM cart WHERE retailer_id = ?', [retailer_id]);
        res.json({ success: true, message: 'Cart cleared' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET CART SUMMARY (count and total)
// ============================================
router.get('/summary', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [result] = await db.query(`
            SELECT 
                COUNT(*) as item_count,
                SUM(quantity) as total_quantity,
                SUM(quantity * unit_price) as subtotal
            FROM cart
            WHERE retailer_id = ?
        `, [retailer_id]);

        res.json({
            item_count: result[0]?.item_count || 0,
            total_quantity: result[0]?.total_quantity || 0,
            subtotal: result[0]?.subtotal || 0
        });
    } catch (error) {
        console.error('Get cart summary error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// REQUEST CREDIT FROM WHOLESALER
// ============================================
router.post('/request', protect, isRetailer, async (req, res) => {
    const { wholesaler_id, amount, items } = req.body;
    const retailer_id = req.user.id;

    try {
        // Create credit request record
        const [result] = await db.query(`
            INSERT INTO credit_requests 
            (retailer_id, wholesaler_id, amount, items, status)
            VALUES (?, ?, ?, ?, 'pending')
        `, [retailer_id, wholesaler_id, amount, JSON.stringify(items)]);

        res.json({
            success: true,
            message: 'Credit request sent successfully',
            request_id: result.insertId
        });
    } catch (error) {
        console.error('Credit request error:', error);
        res.status(500).json({ message: 'Failed to send credit request' });
    }
});

module.exports = router;