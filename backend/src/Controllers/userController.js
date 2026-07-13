const db = require('../config/dbconnect');

exports.searchUsers = async (req, res) => {
    try {
        const searchTerm = `%${req.query.q}%`;

        const [users] = await db.query(`
            SELECT 
                CONCAT('admin-', admin_id) as id, 
                'VendConnect Support' as name, 
                'admin' as userType, 
                profile_picture as profilePicture 
            FROM admins 
            WHERE email LIKE ?

            UNION ALL

            SELECT 
                CONCAT('retailer-', retailer_id) as id, 
                store_name as name, 
                'retailer' as userType, 
                NULL as profilePicture 
            FROM retailers 
            WHERE store_name LIKE ? OR email LIKE ? OR contact_person LIKE ?

            UNION ALL

            SELECT 
                CONCAT('wholesaler-', wholesaler_id) as id, 
                business_name as name, 
                'wholesaler' as userType, 
                profile_picture as profilePicture 
            FROM wholesalers 
            WHERE business_name LIKE ? OR email LIKE ? OR contact_person LIKE ?
            
            LIMIT 20
        `, [
            searchTerm,
            searchTerm, searchTerm, searchTerm,
            searchTerm, searchTerm, searchTerm
        ]);

        res.status(200).json(users);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Error searching users' });
    }
};