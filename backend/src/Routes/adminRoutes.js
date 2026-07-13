const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const { protect, isAdmin, isSuperAdmin } = require('../middleware/MiddlewareAuth');

// All routes are protected by isAdmin middleware
router.use(protect, isAdmin);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const [retailerCount] = await db.query('SELECT COUNT(*) as count FROM retailers WHERE is_active = 1');
        const [wholesalerCount] = await db.query('SELECT COUNT(*) as count FROM wholesalers');
        const [pendingVerifications] = await db.query('SELECT COUNT(*) as count FROM wholesalers WHERE verification_status = "pending"');
        const [orderCount] = await db.query('SELECT COUNT(*) as count FROM orders');
        const [revenue] = await db.query('SELECT SUM(total_amount) as total FROM orders WHERE payment_status = "paid"');

        // Handle disputes table - returns 0 if table doesn't exist
        let disputeCount = 0;
        try {
            const [disputes] = await db.query('SELECT COUNT(*) as count FROM disputes WHERE status IN ("open", "investigating")');
            disputeCount = disputes[0]?.count || 0;
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.log('Disputes table not found - creating it...');
                await db.query(`
                    CREATE TABLE IF NOT EXISTS disputes (
                        dispute_id INT PRIMARY KEY AUTO_INCREMENT,
                        order_id INT NOT NULL,
                        raised_by VARCHAR(50) NOT NULL,
                        raised_by_id INT NOT NULL,
                        reason VARCHAR(255) NOT NULL,
                        description TEXT,
                        status ENUM('open', 'investigating', 'resolved', 'closed') DEFAULT 'open',
                        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                        resolution TEXT,
                        resolved_by INT,
                        resolved_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_order_id (order_id),
                        INDEX idx_status (status),
                        INDEX idx_raised_by (raised_by, raised_by_id),
                        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                disputeCount = 0;
            } else {
                console.error('Disputes query error:', error);
            }
        }

        res.json({
            retailers: retailerCount[0]?.count || 0,
            wholesalers: wholesalerCount[0]?.count || 0,
            pendingVerifications: pendingVerifications[0]?.count || 0,
            orders: orderCount[0]?.count || 0,
            revenue: revenue[0]?.total || 0,
            activeDisputes: disputeCount
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get recent orders for dashboard - FIXED: Using correct column names
router.get('/recent-orders', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT 
                o.order_id, 
                o.order_number, 
                r.store_name as retailer, 
                w.business_name as wholesaler, 
                o.total_amount, 
                o.status,
                o.paid_at as created_at
            FROM orders o
            JOIN retailers r ON o.retailer_id = r.retailer_id
            JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
            ORDER BY o.paid_at DESC
            LIMIT 10
        `);
        res.json(orders);
    } catch (error) {
        console.error('Recent orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// DISPUTE RESOLUTION
// ============================================

// Get all disputes
router.get('/disputes', async (req, res) => {
    const { status } = req.query;
    let query = `
        SELECT d.*, 
               o.order_number,
               r.store_name as retailer_name,
               w.business_name as wholesaler_name,
               CASE 
                   WHEN d.raised_by = 'retailer' THEN r.store_name
                   WHEN d.raised_by = 'wholesaler' THEN w.business_name
                   ELSE 'Unknown'
               END as raised_by_name
        FROM disputes d
        JOIN orders o ON d.order_id = o.order_id
        JOIN retailers r ON o.retailer_id = r.retailer_id
        JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
    `;
    const params = [];

    if (status) {
        query += ' WHERE d.status = ?';
        params.push(status);
    }

    query += ' ORDER BY d.created_at DESC';

    try {
        const [disputes] = await db.query(query, params);
        res.json(disputes);
    } catch (error) {
        console.error('Get disputes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single dispute details
router.get('/disputes/:id', async (req, res) => {
    try {
        const [dispute] = await db.query(`
            SELECT d.*, 
                   o.order_number,
                   r.store_name as retailer_name,
                   w.business_name as wholesaler_name,
                   r.email as retailer_email,
                   w.email as wholesaler_email
            FROM disputes d
            JOIN orders o ON d.order_id = o.order_id
            JOIN retailers r ON o.retailer_id = r.retailer_id
            JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
            WHERE d.dispute_id = ?
        `, [req.params.id]);

        if (dispute.length === 0) {
            return res.status(404).json({ message: 'Dispute not found' });
        }

        res.json(dispute[0]);
    } catch (error) {
        console.error('Get dispute error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new dispute
router.post('/disputes', async (req, res) => {
    const { order_id, raised_by, raised_by_id, reason, description, priority } = req.body;

    if (!order_id || !raised_by || !raised_by_id || !reason) {
        return res.status(400).json({ message: 'Order ID, raised by, and reason are required' });
    }

    try {
        const [result] = await db.query(`
            INSERT INTO disputes (order_id, raised_by, raised_by_id, reason, description, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [order_id, raised_by, raised_by_id, reason, description, priority || 'medium']);

        res.status(201).json({
            dispute_id: result.insertId,
            message: 'Dispute created successfully'
        });
    } catch (error) {
        console.error('Create dispute error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update dispute status
router.put('/disputes/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'investigating', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        await db.query(
            'UPDATE disputes SET status = ? WHERE dispute_id = ?',
            [status, id]
        );
        res.json({ message: 'Dispute status updated successfully' });
    } catch (error) {
        console.error('Update dispute status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Resolve a dispute (Super Admin only)
router.put('/disputes/:id/resolve', isSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { resolution, ruling } = req.body;

    if (!resolution) {
        return res.status(400).json({ message: 'Resolution is required' });
    }

    try {
        const [result] = await db.query(`
            UPDATE disputes 
            SET status = 'resolved', 
                resolution = ?, 
                ruling = ?, 
                resolved_by = ?,
                resolved_at = NOW() 
            WHERE dispute_id = ?
        `, [resolution, ruling || null, req.user.id, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Dispute not found' });
        }

        res.json({ message: 'Dispute resolved successfully' });
    } catch (error) {
        console.error('Resolve dispute error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get dispute statistics
router.get('/disputes/stats/summary', async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) as investigating,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
                SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) as medium,
                SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low
            FROM disputes
        `);
        res.json(stats[0]);
    } catch (error) {
        console.error('Dispute stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET ALL RETAILERS (including unverified)
// ============================================
router.get('/retailers', async (req, res) => {
    try {
        const [retailers] = await db.query(`
            SELECT 
                retailer_id as id, 
                store_name as name, 
                email, 
                phone, 
                address, 
                is_active,
                is_verified,
                CASE 
                    WHEN is_verified = 1 THEN 'approved' 
                    ELSE 'pending' 
                END as status,
                created_at
            FROM retailers
            ORDER BY created_at DESC
        `);
        res.json(retailers);
    } catch (error) {
        console.error('Get retailers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// Get all wholesalers (only verified/approved ones)
// ============================================
router.get('/wholesalers', async (req, res) => {
    try {
        const [wholesalers] = await db.query(`
            SELECT 
                wholesaler_id as id, 
                business_name as name, 
                email, 
                phone, 
                address, 
                specialisation, 
                verification_status as status, 
                business_license, 
                tax_id, 
                created_at
            FROM wholesalers
            WHERE verification_status = 'approved'
            ORDER BY created_at DESC
        `);
        res.json(wholesalers);
    } catch (error) {
        console.error('Get wholesalers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single retailer by ID
router.get('/retailers/:id', async (req, res) => {
    try {
        const [retailer] = await db.query(`
            SELECT 
                retailer_id as id, 
                store_name as name, 
                email, 
                phone, 
                address, 
                is_active as is_active,
                CASE 
                    WHEN is_verified = 1 THEN 'approved' 
                    ELSE 'pending' 
                END as verification_status,
                created_at
            FROM retailers
            WHERE retailer_id = ?
        `, [req.params.id]);

        if (retailer.length === 0) {
            return res.status(404).json({ message: 'Retailer not found' });
        }
        res.json(retailer[0]);
    } catch (error) {
        console.error('Get retailer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single wholesaler by ID
router.get('/wholesalers/:id', async (req, res) => {
    try {
        const [wholesaler] = await db.query(`
            SELECT 
                wholesaler_id as id, 
                business_name as name, 
                email, 
                phone, 
                address,
                specialisation, 
                verification_status as status, 
                business_license, 
                tax_id, 
                created_at
            FROM wholesalers
            WHERE wholesaler_id = ?
        `, [req.params.id]);

        if (wholesaler.length === 0) {
            return res.status(404).json({ message: 'Wholesaler not found' });
        }
        res.json(wholesaler[0]);
    } catch (error) {
        console.error('Get wholesaler error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// CATEGORY MANAGEMENT
// ============================================

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await db.query(`
            SELECT category_id, category_name, slug, description, display_order, is_active, created_at
            FROM categories
            ORDER BY display_order ASC, category_name ASC
        `);
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new category
router.post('/categories', async (req, res) => {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Category name is required' });
    }

    try {
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const [existing] = await db.query(
            'SELECT category_id FROM categories WHERE category_name = ? OR slug = ?',
            [name.trim(), slug]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const [result] = await db.query(
            'INSERT INTO categories (category_name, slug, description) VALUES (?, ?, ?)',
            [name.trim(), slug, description || null]
        );

        res.status(201).json({
            category_id: result.insertId,
            category_name: name.trim(),
            slug: slug,
            description: description || null
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a category
router.put('/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    try {
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        await db.query(
            'UPDATE categories SET category_name = ?, slug = ?, description = ? WHERE category_id = ?',
            [name.trim(), slug, description || null, id]
        );

        res.json({ message: 'Category updated successfully' });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a category
router.delete('/categories/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [products] = await db.query(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [id]
        );

        if (products[0].count > 0) {
            return res.status(400).json({
                message: `Cannot delete category. It is used by ${products[0].count} product(s).`
            });
        }

        await db.query('DELETE FROM categories WHERE category_id = ?', [id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// VERIFICATION MANAGEMENT
// ============================================

// Verify a retailer
router.put('/retailers/:id/verify', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            'UPDATE retailers SET is_verified = 1, verified_at = NOW() WHERE retailer_id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        res.json({ message: 'Retailer verified successfully' });
    } catch (error) {
        console.error('Verify retailer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Suspend or activate a retailer
router.put('/retailers/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const isActive = action === 'activate';

    try {
        const [result] = await db.query(
            'UPDATE retailers SET is_active = ? WHERE retailer_id = ?',
            [isActive, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Retailer not found' });
        }

        res.json({ message: `Retailer ${action}d successfully` });
    } catch (error) {
        console.error('Update retailer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Suspend or activate a wholesaler
router.put('/wholesalers/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const isActive = action === 'activate';

    try {
        const [result] = await db.query(
            'UPDATE wholesalers SET is_active = ? WHERE wholesaler_id = ?',
            [isActive, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Wholesaler not found' });
        }

        res.json({ message: `Wholesaler ${action}d successfully` });
    } catch (error) {
        console.error('Update wholesaler error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get pending wholesalers for verification
router.get('/verification/pending', async (req, res) => {
    try {
        const [pending] = await db.query(`
            SELECT 
                wholesaler_id as id, 
                business_name, 
                email, 
                phone, 
                specialisation, 
                created_at
            FROM wholesalers
            WHERE verification_status = 'pending'
            ORDER BY created_at ASC
        `);
        console.log('Pending wholesalers found:', pending.length);
        res.json(pending);
    } catch (error) {
        console.error('Get pending error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Approve a wholesaler
router.put('/verification/:id/approve', async (req, res) => {
    const { id } = req.params;
    console.log('Approving wholesaler ID:', id);

    try {
        const [check] = await db.query(
            'SELECT wholesaler_id, verification_status FROM wholesalers WHERE wholesaler_id = ?',
            [id]
        );

        if (check.length === 0) {
            return res.status(404).json({ message: 'Wholesaler not found' });
        }

        console.log('Current status:', check[0].verification_status);

        const [result] = await db.query(
            'UPDATE wholesalers SET verification_status = "approved", verified_at = NOW() WHERE wholesaler_id = ?',
            [id]
        );

        console.log('Rows affected:', result.affectedRows);
        res.json({ message: 'Wholesaler approved successfully' });
    } catch (error) {
        console.error('Approve error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Reject a wholesaler
router.put('/verification/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    console.log('Rejecting wholesaler ID:', id);

    try {
        const [check] = await db.query(
            'SELECT wholesaler_id FROM wholesalers WHERE wholesaler_id = ?',
            [id]
        );

        if (check.length === 0) {
            return res.status(404).json({ message: 'Wholesaler not found' });
        }

        const [result] = await db.query(
            'UPDATE wholesalers SET verification_status = "rejected", rejection_reason = ? WHERE wholesaler_id = ?',
            [reason || 'No reason provided', id]
        );

        res.json({ message: 'Wholesaler rejected' });
    } catch (error) {
        console.error('Reject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ============================================
// PRODUCT MODERATION
// ============================================

// Get all products (for moderation)
router.get('/products', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.product_id, p.name, p.sku, p.base_price, p.status,
                   w.business_name as wholesaler, c.category_name as category
            FROM products p
            JOIN wholesalers w ON p.wholesaler_id = w.wholesaler_id
            JOIN categories c ON p.category_id = c.category_id
            ORDER BY p.created_at DESC
        `);
        res.json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get flagged products
router.get('/products/flagged', async (req, res) => {
    try {
        const [flagged] = await db.query(`
            SELECT p.product_id, p.name, p.sku, w.business_name as wholesaler,
                   f.reason, f.created_at as flagged_at
            FROM flagged_products f
            JOIN products p ON f.product_id = p.product_id
            JOIN wholesalers w ON p.wholesaler_id = w.wholesaler_id
            WHERE f.status = 'pending'
            ORDER BY f.created_at DESC
        `);
        res.json(flagged);
    } catch (error) {
        console.error('Get flagged error (table may not exist):', error.message);
        res.json([]);
    }
});

// Update product status (active/inactive)
router.put('/products/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await db.query(
            'UPDATE products SET status = ? WHERE product_id = ?',
            [status, id]
        );
        res.json({ message: 'Product status updated' });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a product (Super Admin only)
router.delete('/products/:id', isSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM products WHERE product_id = ?', [id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// ORDER MONITORING
// ============================================

// Get all orders
router.get('/orders', async (req, res) => {
    const { status, startDate, endDate } = req.query;

    let query = `
        SELECT o.order_id, o.order_number, r.store_name as retailer, 
               w.business_name as wholesaler, o.total_amount, o.status, 
               o.payment_status, o.paid_at as order_date
        FROM orders o
        JOIN retailers r ON o.retailer_id = r.retailer_id
        JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
        WHERE 1=1
    `;
    const params = [];

    if (status) {
        query += ' AND o.status = ?';
        params.push(status);
    }
    if (startDate) {
        query += ' AND o.paid_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND o.paid_at <= ?';
        params.push(endDate);
    }

    query += ' ORDER BY o.paid_at DESC';

    try {
        const [orders] = await db.query(query, params);
        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single order details
router.get('/orders/:id', async (req, res) => {
    try {
        const [order] = await db.query(`
            SELECT o.*, r.store_name as retailer_name, r.email as retailer_email,
                   w.business_name as wholesaler_name, w.email as wholesaler_email
            FROM orders o
            JOIN retailers r ON o.retailer_id = r.retailer_id
            JOIN wholesalers w ON o.wholesaler_id = w.wholesaler_id
            WHERE o.order_id = ?
        `, [req.params.id]);

        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const [items] = await db.query(`
            SELECT oi.product_name, oi.quantity, oi.unit_price, oi.total_price
            FROM order_items oi
            WHERE oi.order_id = ?
        `, [req.params.id]);

        res.json({ ...order[0], items });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// CREDIT MANAGEMENT
// ============================================

// Get all retailer credit profiles
router.get('/credit/profiles', async (req, res) => {
    try {
        const [profiles] = await db.query(`
            SELECT rcp.profile_id, r.store_name as retailer, r.email,
                   rcp.credit_score, rcp.credit_limit, rcp.used_credit,
                   rcp.credit_status, rcp.updated_at
            FROM retailer_credit_profiles rcp
            JOIN retailers r ON rcp.retailer_id = r.retailer_id
            ORDER BY rcp.credit_score DESC
        `);
        res.json(profiles);
    } catch (error) {
        console.error('Get credit profiles error (table may not exist):', error.message);
        res.json([]);
    }
});

// Update retailer credit limit (Super Admin only)
router.put('/credit/retailers/:id/limit', isSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const { credit_limit } = req.body;

    try {
        await db.query(
            'UPDATE retailer_credit_profiles SET credit_limit = ? WHERE retailer_id = ?',
            [credit_limit, id]
        );
        res.json({ message: 'Credit limit updated' });
    } catch (error) {
        console.error('Update credit limit error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// PLATFORM SETTINGS (Super Admin Only)
// ============================================

// Get all platform settings
router.get('/settings', isSuperAdmin, async (req, res) => {
    try {
        const [settings] = await db.query('SELECT * FROM platform_settings ORDER BY category, setting_key');
        res.json(settings);
    } catch (error) {
        console.error('Get settings error (table may not exist):', error.message);
        res.json([]);
    }
});

// Update a platform setting
router.put('/settings/:key', isSuperAdmin, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    try {
        await db.query(
            'UPDATE platform_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
            [value, key]
        );
        res.json({ message: 'Setting updated successfully' });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// ACTIVITY LOGS
// ============================================

// Get recent activity logs
router.get('/logs', async (req, res) => {
    const { limit = 50, offset = 0 } = req.query;

    try {
        const [logs] = await db.query(`
            SELECT log_id, admin_id, action_type, target_type, target_id, 
                   description, ip_address, created_at
            FROM admin_activity_logs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), parseInt(offset)]);

        const [total] = await db.query('SELECT COUNT(*) as count FROM admin_activity_logs');

        res.json({
            logs,
            total: total[0]?.count || 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get logs error (table may not exist):', error.message);
        res.json({ logs: [], total: 0, limit: parseInt(limit), offset: parseInt(offset) });
    }
});

// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================

// Get all admins
router.get('/admins', isSuperAdmin, async (req, res) => {
    try {
        const [admins] = await db.query(`
            SELECT admin_id as id, email, email as name, role, is_active as status, last_login, created_at
            FROM admins
            ORDER BY created_at ASC
        `);
        res.json(admins);
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new admin
router.post('/admins', isSuperAdmin, async (req, res) => {
    const { email, full_name, password, role } = req.body;
    const bcrypt = require('bcrypt');

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.query(
            'INSERT INTO admins (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, full_name, role || 'moderator']
        );

        res.status(201).json({ id: result.insertId, email, full_name, role });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete an admin
router.delete('/admins/:id', isSuperAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM admins WHERE admin_id = ?', [id]);
        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Delete admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;