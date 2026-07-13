const db = require('../config/dbconnect');

// @desc    Create a new product
// @route   POST /api/products
// @access  Wholesaler only
const createProduct = async (req, res) => {
    const {
        sku, name, description, base_price,
        stock_quantity, min_order_quantity, category_id,
        main_image_url, status = 'active'
    } = req.body;

    const wholesaler_id = req.user.id;

    try {
        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const [result] = await db.query(
            `INSERT INTO products 
            (wholesaler_id, category_id, sku, name, description, 
             base_price, stock_quantity, min_order_quantity, 
             main_image_url, slug, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [wholesaler_id, category_id, sku, name, description,
             base_price, stock_quantity, min_order_quantity || 1,
             main_image_url, slug, status]
        );

        res.status(201).json({
            success: true,
            product_id: result.insertId,
            message: 'Product created successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all products (with filters)
// @route   GET /api/products
// @access  Public (retailers, wholesalers)
const getProducts = async (req, res) => {
    const { category, min_price, max_price, search, limit = 20, offset = 0 } = req.query;

    try {
        let query = `
            SELECT p.*, c.category_name, w.business_name as supplier_name
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            JOIN wholesalers w ON p.wholesaler_id = w.wholesaler_id
            WHERE p.status = 'active'
        `;
        const params = [];

        if (category) {
            query += ` AND p.category_id = ?`;
            params.push(category);
        }

        if (min_price) {
            query += ` AND p.base_price >= ?`;
            params.push(min_price);
        }

        if (max_price) {
            query += ` AND p.base_price <= ?`;
            params.push(max_price);
        }

        if (search) {
            query += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [products] = await db.query(query, params);

        res.json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    const { id } = req.params;

    try {
        const [products] = await db.query(
            `SELECT p.*, c.category_name, w.business_name as supplier_name,
                    w.email as supplier_email, w.phone as supplier_phone
             FROM products p
             JOIN categories c ON p.category_id = c.category_id
             JOIN wholesalers w ON p.wholesaler_id = w.wholesaler_id
             WHERE p.product_id = ? AND p.status = 'active'`,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({ success: true, product: products[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get wholesaler's own products
// @route   GET /api/products/my-products
// @access  Wholesaler only
const getMyProducts = async (req, res) => {
    const wholesaler_id = req.user.id;

    try {
        const [products] = await db.query(
            `SELECT p.*, c.category_name
             FROM products p
             JOIN categories c ON p.category_id = c.category_id
             WHERE p.wholesaler_id = ?
             ORDER BY p.created_at DESC`,
            [wholesaler_id]
        );

        res.json({ success: true, count: products.length, products });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Wholesaler (owner only)
const updateProduct = async (req, res) => {
    const { id } = req.params;
    const wholesaler_id = req.user.id;
    const updates = req.body;

    try {
        // Check if product exists and belongs to this wholesaler
        const [existing] = await db.query(
            'SELECT * FROM products WHERE product_id = ? AND wholesaler_id = ?',
            [id, wholesaler_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Product not found or not yours' });
        }

        // Build update query dynamically
        const allowedFields = ['name', 'description', 'base_price', 'stock_quantity', 
                               'min_order_quantity', 'category_id', 'main_image_url', 'status'];
        const updateFields = [];
        const updateValues = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(updates[field]);
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        updateValues.push(id, wholesaler_id);
        await db.query(
            `UPDATE products SET ${updateFields.join(', ')} WHERE product_id = ? AND wholesaler_id = ?`,
            updateValues
        );

        res.json({ success: true, message: 'Product updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Wholesaler (owner only)
const deleteProduct = async (req, res) => {
    const { id } = req.params;
    const wholesaler_id = req.user.id;

    try {
        const [result] = await db.query(
            'DELETE FROM products WHERE product_id = ? AND wholesaler_id = ?',
            [id, wholesaler_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found or not yours' });
        }

        res.json({ success: true, message: 'Product deleted successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    getMyProducts,
    updateProduct,
    deleteProduct
};