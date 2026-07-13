const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, isWholesaler } = require('../middleware/MiddlewareAuth');

// Configure multer for product images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/products/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `product-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ============================================
// PUBLIC: GET ALL CATEGORIES (No authentication required)
// ============================================
router.get('/categories-list', async (req, res) => {
    try {
        const [categories] = await db.query(`
            SELECT 
                category_id, 
                category_name, 
                slug, 
                description,
                display_order
            FROM categories
            WHERE is_active = 1 OR is_active IS NULL
            ORDER BY display_order ASC, category_name ASC
        `);
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET ALL PRODUCTS (for retailers - Only ACTIVE products)
// ============================================
router.get('/', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT p.*, w.business_name as supplier_name, w.wholesaler_id,
                   c.category_name
            FROM products p
            JOIN wholesalers w ON p.wholesaler_id = w.wholesaler_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.status = 'active' 
              AND p.stock_quantity > 0
              AND p.deleted_at IS NULL
            ORDER BY p.created_at DESC
        `);
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET WHOLESALER'S OWN PRODUCTS (Includes soft-deleted products with indicator)
// ============================================
router.get('/my-products', protect, isWholesaler, async (req, res) => {
    try {
        // Check if user exists
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Unauthorized - User not found' });
        }

        const [products] = await db.query(`
            SELECT p.*, c.category_name,
                   CASE 
                       WHEN p.deleted_at IS NOT NULL THEN 'deleted'
                       WHEN p.status = 'inactive' THEN 'inactive'
                       ELSE 'active'
                   END as product_status
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.wholesaler_id = ?
            ORDER BY p.deleted_at IS NOT NULL, p.status = 'inactive', p.created_at DESC
        `, [req.user.id]);

        // Convert imageUrl to full URL if needed
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const productsWithFullUrl = products.map(product => ({
            ...product,
            imageUrl: product.imageUrl ?
                (product.imageUrl.startsWith('http') ? product.imageUrl : `${baseUrl}${product.imageUrl}`) :
                null
        }));

        res.json(productsWithFullUrl);
    } catch (error) {
        console.error('Get my-products error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// CREATE PRODUCT (with image upload)
// ============================================
router.post('/', protect, isWholesaler, upload.single('product_image'), async (req, res) => {
    const {
        name,
        sku,
        description,
        base_price,
        stock_quantity,
        min_order_quantity,
        category_id,
        status = 'active'
    } = req.body;

    // Check if user exists
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Unauthorized - User not found' });
    }

    const wholesaler_id = req.user.id;

    if (!name || !base_price || !stock_quantity) {
        return res.status(400).json({ message: 'Name, price, and stock quantity are required' });
    }

    try {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const productSku = sku || `${wholesaler_id}-${Date.now()}`;

        let imageUrl = null;
        if (req.file) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/products/${req.file.filename}`;
            console.log(' Image URL saved:', imageUrl);
        }

        const [result] = await db.query(`
            INSERT INTO products
            (wholesaler_id, category_id, sku, name, description,
                base_price, stock_quantity, min_order_quantity,
                imageUrl, slug, status,
                shipping_cost, shipping_per_unit, free_shipping_threshold, shipping_notes) 
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [wholesaler_id, category_id || null, productSku, name, description,
            base_price, stock_quantity, min_order_quantity || 1,
            imageUrl, slug, status,
            req.body.shipping_cost || 0,
            req.body.shipping_per_unit === 'true' || req.body.shipping_per_unit === true ? 1 : 0,
            req.body.free_shipping_threshold || null,
            req.body.shipping_notes || null]);

        res.status(201).json({
            success: true,
            product_id: result.insertId,
            message: 'Product created successfully'
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// UPDATE PRODUCT
// ============================================
router.put('/:id', protect, isWholesaler, upload.single('product_image'), async (req, res) => {
    const { id } = req.params;

    // Check if user exists
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Unauthorized - User not found' });
    }

    const wholesaler_id = req.user.id;
    const {
        name,
        description,
        base_price,
        stock_quantity,
        min_order_quantity,
        category_id,
        status
    } = req.body;

    try {
        const [existing] = await db.query(
            'SELECT * FROM products WHERE product_id = ? AND wholesaler_id = ?',
            [id, wholesaler_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if product is soft-deleted
        if (existing[0].deleted_at !== null) {
            return res.status(400).json({
                message: 'Cannot update a deleted product. Please restore it first.'
            });
        }

        let imageUrl = existing[0].imageUrl;

        if (req.file) {
            if (imageUrl) {
                const oldFileName = imageUrl.split('/').pop();
                const oldFilePath = path.join(__dirname, '../uploads/products/', oldFileName);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/products/${req.file.filename}`;
        }

        await db.query(`
            UPDATE products 
            SET name = ?, description = ?, base_price = ?, 
                stock_quantity = ?, min_order_quantity = ?, 
                category_id = ?, imageUrl = ?, status = ?,
                shipping_cost = ?, shipping_per_unit = ?, 
                free_shipping_threshold = ?, shipping_notes = ?
            WHERE product_id = ? AND wholesaler_id = ?
        `, [name, description, base_price, stock_quantity, min_order_quantity || 1,
            category_id || null, imageUrl, status || 'active',
            req.body.shipping_cost || 0,
            req.body.shipping_per_unit === 'true' || req.body.shipping_per_unit === true ? 1 : 0,
            req.body.free_shipping_threshold || null,
            req.body.shipping_notes || null,
            id, wholesaler_id]);

        res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// DELETE PRODUCT - SOFT DELETE (Recommended)
// Product removed from marketplace but order history preserved
// ============================================
router.delete('/:id', protect, isWholesaler, async (req, res) => {
    const { id } = req.params;

    // Check if user exists
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized - User not found'
        });
    }

    const wholesaler_id = req.user.id;

    try {
        // First, verify the product belongs to this wholesaler
        const [product] = await db.query(
            'SELECT product_id, wholesaler_id, imageUrl, status, deleted_at FROM products WHERE product_id = ?',
            [id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if the product belongs to the wholesaler
        if (product[0].wholesaler_id !== wholesaler_id) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this product'
            });
        }

        // Check if product is already deleted
        if (product[0].deleted_at !== null) {
            return res.status(400).json({
                success: false,
                message: 'This product has already been deleted'
            });
        }

        // Check if product has any orders (for informational purposes only)
        const [orderItems] = await db.query(
            'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?',
            [id]
        );

        // SOFT DELETE - Mark as deleted and inactive
        await db.query(
            `UPDATE products 
             SET status = 'inactive', 
                 deleted_at = NOW() 
             WHERE product_id = ? AND wholesaler_id = ?`,
            [id, wholesaler_id]
        );

        // Note: We KEEP the image file in case it's needed for order history
        // If you want to delete the image, uncomment the code below:
        /*
        if (product[0].imageUrl) {
            try {
                const fileName = product[0].imageUrl.split('/').pop();
                const filePath = path.join(__dirname, '../uploads/products/', fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted image: ${fileName}`);
                }
            } catch (fileError) {
                console.error('Error deleting image file:', fileError);
            }
        }
        */

        res.json({
            success: true,
            message: `Product has been deleted from the marketplace. It was associated with ${orderItems[0].count} order(s) which remain intact.`,
            product_id: id,
            associated_orders: orderItems[0].count,
            status: 'deleted'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product',
            error: error.message
        });
    }
});

// ============================================
// RESTORE PRODUCT (Undo soft delete)
// ============================================
router.put('/:id/restore', protect, isWholesaler, async (req, res) => {
    const { id } = req.params;

    // Check if user exists
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized - User not found'
        });
    }

    const wholesaler_id = req.user.id;

    try {
        const [product] = await db.query(
            'SELECT product_id, wholesaler_id, deleted_at FROM products WHERE product_id = ?',
            [id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (product[0].wholesaler_id !== wholesaler_id) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to restore this product'
            });
        }

        if (product[0].deleted_at === null) {
            return res.status(400).json({
                success: false,
                message: 'This product is not deleted'
            });
        }

        // Restore the product
        await db.query(
            `UPDATE products 
             SET status = 'active', 
                 deleted_at = NULL 
             WHERE product_id = ? AND wholesaler_id = ?`,
            [id, wholesaler_id]
        );

        res.json({
            success: true,
            message: 'Product restored successfully',
            product_id: id,
            status: 'restored'
        });

    } catch (error) {
        console.error('Restore product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restore product',
            error: error.message
        });
    }
});

// ============================================
// GET SINGLE PRODUCT (MUST be LAST - catches /:id)
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const [product] = await db.query(`
            SELECT p.*, w.business_name as supplier_name, w.wholesaler_id,
                   w.email as supplier_email, w.phone as supplier_phone,
                   c.category_name
            FROM products p
            JOIN wholesalers w ON p.wholesaler_id = w.wholesaler_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id = ? 
              AND p.status = 'active' 
              AND p.deleted_at IS NULL
        `, [req.params.id]);

        if (product.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET DELETED PRODUCTS (For wholesaler to see their deleted products)
// ============================================
router.get('/deleted/products', protect, isWholesaler, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Unauthorized - User not found' });
        }

        const [products] = await db.query(`
            SELECT p.*, c.category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.wholesaler_id = ? 
              AND p.deleted_at IS NOT NULL
            ORDER BY p.deleted_at DESC
        `, [req.user.id]);

        res.json(products);
    } catch (error) {
        console.error('Get deleted products error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;