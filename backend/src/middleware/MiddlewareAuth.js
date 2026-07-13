const jwt = require('jsonwebtoken');
const db = require('../config/dbconnect'); // Make sure this path is correct

// Protect middleware - verifies token and attaches user to req
const protect = async (req, res, next) => {
    let token;

    console.log('=== PROTECT MIDDLEWARE ===');
    console.log('Authorization header:', req.headers.authorization);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('Token extracted (first 50 chars):', token.substring(0, 50) + '...');

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Decoded token:', decoded);

            // Fetch user based on usertype
            let user;
            if (decoded.usertype === 'retailer') {
                const [rows] = await db.query(
                    'SELECT retailer_id as id, email, store_name as name, "retailer" as userType FROM retailers WHERE retailer_id = ?',
                    [decoded.id]
                );
                user = rows[0];
                console.log('Retailer query result:', user);
            } else if (decoded.usertype === 'wholesaler') {
                const [rows] = await db.query(
                    'SELECT wholesaler_id as id, email, business_name as name, "wholesaler" as userType FROM wholesalers WHERE wholesaler_id = ?',
                    [decoded.id]
                );
                user = rows[0];
                console.log('Wholesaler query result:', user);
            } else if (decoded.usertype === 'admin') {
                //  using email as name 
                const [rows] = await db.query(
                    'SELECT admin_id as id, email, email as name, role, "admin" as userType FROM admins WHERE admin_id = ?',
                    [decoded.id]
                );
                user = rows[0];
                console.log('Admin query result:', user);
            }

            if (!user) {
                console.log('❌ User not found for id:', decoded.id, 'type:', decoded.usertype);
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            console.log(' User found, attaching to req.user');
            req.user = user;
            next();
        } catch (error) {
            console.error('❌ Token verification error:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        console.log('❌ No token provided or invalid Authorization header format');
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Check if user is a wholesaler (using userType, not usertype)
const isWholesaler = (req, res, next) => {
    if (req.user && req.user.userType === 'wholesaler') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Wholesaler only.' });
    }
};

//  Check if user is a retailer (using userType, not usertype)
const isRetailer = (req, res, next) => {
    if (req.user && req.user.userType === 'retailer') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Retailer only.' });
    }
};

// Check if user is ANY admin (super_admin or moderator) (using userType, not usertype)
const isAdmin = (req, res, next) => {
    if (req.user && req.user.userType === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

//  Check if user is SUPER admin only
const isSuperAdmin = (req, res, next) => {
    if (req.user && req.user.userType === 'admin' && req.user.role === 'super_admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Super admin only.' });
    }
};

//  Check if user is MODERATOR only
const isModerator = (req, res, next) => {
    if (req.user && req.user.userType === 'admin' && req.user.role === 'moderator') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Moderator only.' });
    }
};

// Export all middleware functions
module.exports = {
    protect,
    isWholesaler,
    isRetailer,
    isAdmin,
    isSuperAdmin,
    isModerator
};