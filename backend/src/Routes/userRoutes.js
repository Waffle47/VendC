const express = require('express');
const router = express.Router();
const db = require('../config/dbconnect');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/MiddlewareAuth');
const userController = require('../Controllers/userController');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads/profiles/';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
    }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: fileFilter
});

// ============================================
// UPLOAD PROFILE PICTURE
// ============================================
router.post('/profile/picture', protect, upload.single('profile_picture'), async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.userType;


    console.log('Profile picture upload request for user:', userId, 'type:', userType);

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        // Determine table and id field
        let table, idField;
        if (userType === 'retailer') {
            table = 'retailers';
            idField = 'retailer_id';
        } else if (userType === 'wholesaler') {
            table = 'wholesalers';
            idField = 'wholesaler_id';
        } else if (userType === 'admin') {
            table = 'admins';
            idField = 'admin_id';
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        // Get old profile picture to delete
        const [oldUser] = await db.query(
            `SELECT profile_picture FROM ${table} WHERE ${idField} = ?`,
            [userId]
        );

        if (oldUser.length > 0 && oldUser[0].profile_picture) {
            const oldFilePath = path.join(__dirname, '..', oldUser[0].profile_picture);
            if (fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
            }
        }

        // Save profile picture path to database
        const profilePicturePath = `/uploads/profiles/${req.file.filename}`;

        await db.query(
            `UPDATE ${table} SET profile_picture = ? WHERE ${idField} = ?`,
            [profilePicturePath, userId]
        );

        // Return the full URL for the frontend
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const profilePictureUrl = `${baseUrl}${profilePicturePath}`;

        res.json({
            message: 'Profile picture uploaded successfully',
            profile_picture: profilePictureUrl
        });

    } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// GET PROFILE PICTURE
// ============================================
router.get('/profile/picture', protect, async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.userType;

    try {
        let table, idField;
        if (userType === 'retailer') {
            table = 'retailers';
            idField = 'retailer_id';
        } else if (userType === 'wholesaler') {
            table = 'wholesalers';
            idField = 'wholesaler_id';
        } else if (userType === 'admin') {
            table = 'admins';
            idField = 'admin_id';
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        const [user] = await db.query(
            `SELECT profile_picture FROM ${table} WHERE ${idField} = ?`,
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ profile_picture: user[0].profile_picture || null });

    } catch (error) {
        console.error('Get profile picture error:', error);
        res.status(500).json({ message: 'Server error' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const profilePictureUrl = user[0].profile_picture
        ? `${baseUrl}${user[0].profile_picture}`
        : null;

    res.json({ profile_picture: profilePictureUrl });

});

// ============================================
// UPDATE PROFILE (name, phone, address)
// ============================================
router.put('/profile', protect, async (req, res) => {
    const { name, phone, address } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    try {
        let table, idField, nameField;
        if (userType === 'retailer') {
            table = 'retailers';
            idField = 'retailer_id';
            nameField = 'store_name';
        } else if (userType === 'wholesaler') {
            table = 'wholesalers';
            idField = 'wholesaler_id';
            nameField = 'business_name';
        } else if (userType === 'admin') {
            table = 'admins';
            idField = 'admin_id';
            nameField = 'full_name';
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        await db.query(
            `UPDATE ${table} SET ${nameField} = ?, phone = ?, address = ? WHERE ${idField} = ?`,
            [name || null, phone || null, address || null, userId]
        );

        const [updatedUser] = await db.query(
            `SELECT ${idField} as id, email, ${nameField} as name, phone, address FROM ${table} WHERE ${idField} = ?`,
            [userId]
        );

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser[0]
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// CHANGE PASSWORD
// ============================================
router.put('/password', protect, async (req, res) => {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    if (!current_password || !new_password) {
        return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    try {
        let table, idField;
        if (userType === 'retailer') {
            table = 'retailers';
            idField = 'retailer_id';
        } else if (userType === 'wholesaler') {
            table = 'wholesalers';
            idField = 'wholesaler_id';
        } else if (userType === 'admin') {
            table = 'admins';
            idField = 'admin_id';
        } else {
            return res.status(400).json({ message: 'Invalid user type' });
        }

        const [users] = await db.query(
            `SELECT * FROM ${table} WHERE ${idField} = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(current_password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(new_password, salt);

        await db.query(
            `UPDATE ${table} SET password_hash = ? WHERE ${idField} = ?`,
            [hashedPassword, userId]
        );

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/search', userController.searchUsers);

// ============================================
// SEARCH USERS (for chat)
// ============================================
router.get('/search', protect, async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 2) {
        return res.json([]);
    }

    try {
        // Search retailers
        const [retailers] = await db.query(`
            SELECT 
                retailer_id as id, 
                store_name as name, 
                email, 
                'retailer' as userType,
                profile_picture
            FROM retailers 
            WHERE (store_name LIKE ? OR email LIKE ?)
            LIMIT 10
        `, [`%${q}%`, `%${q}%`]);

        // Search wholesalers
        const [wholesalers] = await db.query(`
            SELECT 
                wholesaler_id as id, 
                business_name as name, 
                email, 
                'wholesaler' as userType,
                profile_picture
            FROM wholesalers 
            WHERE (business_name LIKE ? OR email LIKE ?)
            LIMIT 10
        `, [`%${q}%`, `%${q}%`]);

        // Search admins - use email as name since no full_name column
        const [admins] = await db.query(`
            SELECT 
                admin_id as id, 
                email as name, 
                email, 
                'admin' as userType,
                profile_picture
            FROM admins 
            WHERE email LIKE ?
            AND role != 'super_admin'
            LIMIT 5
        `, [`%${q}%`]);

        // Combine and format results
        const results = [...retailers, ...wholesalers, ...admins].map(user => ({
            id: `${user.userType}_${user.id}`,
            name: user.name,
            email: user.email,
            userType: user.userType,
            profilePicture: user.profile_picture || null
        }));

        res.json(results);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;