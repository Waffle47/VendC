const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const { protect, isRetailer } = require('../middleware/MiddlewareAuth');

// ============================================
// CREATE REVIEW (for delivered orders)
// ============================================
router.post('/create', protect, isRetailer, async (req, res) => {
    const { order_id, rating, title, comment } = req.body;
    const retailer_id = req.user.id;

    if (!order_id || !rating) {
        return res.status(400).json({ message: 'Order ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    try {
        // Verify order belongs to this retailer and is delivered
        const [order] = await db.query(`
            SELECT o.*, w.business_name as wholesaler_name, w.wholesaler_id
            FROM orders o
            JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
            WHERE o.order_id = ? AND o.retailer_id = ? AND o.status = 'delivered'
        `, [order_id, retailer_id]);

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found or not delivered yet' });
        }

        // Get order items to fetch product name from products table
        const [orderItems] = await db.query(`
            SELECT oi.product_id, p.name as product_name 
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = ?
        `, [order_id]);

        // Check if review already exists for this order
        const [existing] = await db.query(`
            SELECT * FROM reviews WHERE order_id = ? AND retailer_id = ?
        `, [order_id, retailer_id]);

        if (existing.length > 0) {
            return res.status(400).json({ message: 'You have already reviewed this order' });
        }

        // If no order items found, use wholesaler name as fallback
        let productId = null;
        let productName = order[0].wholesaler_name || 'Product';

        if (orderItems.length > 0) {
            // For now, use the first product in the order
            productId = orderItems[0].product_id;
            productName = orderItems[0].product_name;
        }

        // Insert review with product info
        const [result] = await db.query(`
            INSERT INTO reviews 
            (order_id, retailer_id, wholesaler_id, product_id, product_name, rating, title, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [order_id, retailer_id, order[0].wholesaler_id, productId, productName, rating, title || null, comment || null]);

        res.status(201).json({
            success: true,
            review_id: result.insertId,
            message: 'Review submitted successfully'
        });

    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET RETAILER'S REVIEWS
// ============================================
router.get('/my-reviews', protect, isRetailer, async (req, res) => {
    const retailer_id = req.user.id;

    try {
        const [reviews] = await db.query(`
            SELECT 
                r.*, 
                w.business_name as wholesaler_name, 
                o.order_number
            FROM reviews r
            JOIN wholesalers w ON r.wholesaler_id = w.wholesaler_id
            LEFT JOIN orders o ON r.order_id = o.order_id
            WHERE r.retailer_id = ?
            ORDER BY r.created_at DESC
        `, [retailer_id]);

        res.json(reviews);
    } catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// DELETE REVIEW
// ============================================
router.delete('/:review_id', protect, isRetailer, async (req, res) => {
    const { review_id } = req.params;
    const retailer_id = req.user.id;

    try {
        const [result] = await db.query(
            'DELETE FROM reviews WHERE review_id = ? AND retailer_id = ?',
            [review_id, retailer_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET REVIEWS FOR A WHOLESALER (public)
// ============================================
router.get('/wholesaler/:wholesaler_id', async (req, res) => {
    const { wholesaler_id } = req.params;

    try {
        const [reviews] = await db.query(`
            SELECT r.*, rt.store_name as retailer_name
            FROM reviews r
            JOIN retailers rt ON r.retailer_id = rt.retailer_id
            WHERE r.wholesaler_id = ?
            ORDER BY r.created_at DESC
            LIMIT 20
        `, [wholesaler_id]);

        const [avgResult] = await db.query(`
            SELECT 
                COALESCE(AVG(rating), 0) as average_rating, 
                COUNT(*) as total_reviews
            FROM reviews
            WHERE wholesaler_id = ?
        `, [wholesaler_id]);

        res.json({
            reviews: reviews,
            average_rating: parseFloat(avgResult[0].average_rating) || 0,
            total_reviews: avgResult[0].total_reviews || 0
        });
    } catch (error) {
        console.error('Get wholesaler reviews error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET REVIEWS FOR A SPECIFIC PRODUCT
// ============================================
router.get('/product/:product_id', async (req, res) => {
    const { product_id } = req.params;

    try {
        const [reviews] = await db.query(`
            SELECT r.*, rt.store_name as retailer_name
            FROM reviews r
            JOIN retailers rt ON r.retailer_id = rt.retailer_id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        `, [product_id]);

        const [avgResult] = await db.query(`
            SELECT 
                COALESCE(AVG(rating), 0) as average_rating, 
                COUNT(*) as total_reviews
            FROM reviews
            WHERE product_id = ?
        `, [product_id]);

        res.json({
            reviews: reviews,
            average_rating: parseFloat(avgResult[0].average_rating) || 0,
            total_reviews: avgResult[0].total_reviews || 0
        });
    } catch (error) {
        console.error('Get product reviews error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;