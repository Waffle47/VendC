const bcrypt = require('bcrypt');
const db = require('../config/dbconnect');
const generateToken = require('../utils/TokenGenerator');

// ============================================
// LOGIN FUNCTION
// ============================================
const login = async (req, res) => {
    const { email, password } = req.body;

    console.log(' Login attempt for email:', email);

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // Check retailers
        let [user] = await db.query('SELECT *, profile_picture FROM retailers WHERE email = ?', [email]);
        let userType = 'retailer';
        let idField = 'retailer_id';
        let nameField = 'store_name';
        let role = null;
        let profile_picture = user[0]?.profile_picture || null;

        if (user.length === 0) {
            [user] = await db.query('SELECT *, profile_picture FROM wholesalers WHERE email = ?', [email]);
            userType = 'wholesaler';
            idField = 'wholesaler_id';
            nameField = 'business_name';
            profile_picture = user[0]?.profile_picture || null;
        }

        if (user.length === 0) {
            // IMPORTANT: Include role field for admin
            [user] = await db.query('SELECT *, role, profile_picture FROM admins WHERE email = ?', [email]);
            userType = 'admin';
            idField = 'admin_id';
            nameField = 'full_name';
            profile_picture = user[0]?.profile_picture || null;
            if (user.length > 0) {
                role = user[0].role;
            }
        }

        if (user.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        console.log('✅ User found. User type:', userType);
        console.log('📝 Stored hash (first 20 chars):', user[0].password_hash?.substring(0, 20) + '...');

        // Compare passwords
        const isValid = await bcrypt.compare(password, user[0].password_hash);

        console.log('🔐 Password valid?', isValid);

        if (!isValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate token with role if available
        const token = generateToken(user[0][idField], userType, role);

        console.log('🎫 Token generated successfully');

        // Convert profile_picture to full URL if it exists
        let fullProfilePicture = null;
        if (profile_picture) {
            if (profile_picture.startsWith('http')) {
                fullProfilePicture = profile_picture;
            } else {
                // Point to the live Render backend instead of localhost
                fullProfilePicture = `https://vendconnect-backend.onrender.com${profile_picture}`;
            }
        }

        return res.json({
            // CRITICAL FIX: GCID Formatting applied to the ID
            id: userType === 'admin' ? 'admin-support' : `${userType}-${user[0][idField]}`,
            raw_id: user[0][idField], // Kept the pure integer safe for other non-chat API routes
            email: user[0].email,
            name: user[0][nameField],
            userType: userType,
            role: role,
            profile_picture: fullProfilePicture,
            token: token
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// REGISTER RETAILER
// ============================================
const registerRetailer = async (req, res) => {
    const { email, password, store_name, phone, address } = req.body;

    console.log('📝 Registering retailer:', email);

    try {
        // Check if retailer already exists
        const [existing] = await db.query('SELECT * FROM retailers WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Retailer already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert retailer
        const [result] = await db.query(
            `INSERT INTO retailers (email, password_hash, store_name, phone, address, is_active) 
             VALUES (?, ?, ?, ?, ?, 1)`,
            [email, hashedPassword, store_name, phone, address]
        );

        // Generate token
        const token = generateToken(result.insertId, 'retailer');

        console.log('✅ Retailer registered successfully, ID:', result.insertId);

        return res.status(201).json({
            // CRITICAL FIX: GCID Formatting applied
            id: `retailer-${result.insertId}`,
            raw_id: result.insertId,
            email: email,
            name: store_name,
            userType: 'retailer',
            profile_picture: null,
            token: token
        });

    } catch (error) {
        console.error('❌ Register retailer error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// REGISTER WHOLESALER
// ============================================
const registerWholesaler = async (req, res) => {
    const { email, password, business_name, phone, address, business_license, tax_id, specialisation } = req.body;

    console.log('📝 Registering wholesaler:', email);

    try {
        // Check if wholesaler already exists
        const [existing] = await db.query('SELECT * FROM wholesalers WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Wholesaler already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert wholesaler
        const [result] = await db.query(
            `INSERT INTO wholesalers 
             (email, password_hash, business_name, phone, address, business_license, tax_id, specialisation, verification_status, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
            [email, hashedPassword, business_name, phone, address, business_license || null, tax_id || null, specialisation || null]
        );

        // Generate token
        const token = generateToken(result.insertId, 'wholesaler');

        console.log('✅ Wholesaler registered successfully, ID:', result.insertId);

        return res.status(201).json({
            // CRITICAL FIX: GCID Formatting applied
            id: `wholesaler-${result.insertId}`,
            raw_id: result.insertId,
            email: email,
            name: business_name,
            userType: 'wholesaler',
            profile_picture: null,
            token: token
        });

    } catch (error) {
        console.error('❌ Register wholesaler error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
    login,
    registerRetailer,
    registerWholesaler
};