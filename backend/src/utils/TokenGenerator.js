const jwt = require('jsonwebtoken');

const generateToken = (id, usertype, role = null) => {
    console.log('=== generateToken called ===');
    console.log('id:', id);
    console.log('usertype:', usertype);
    console.log('role:', role);
    console.log('JWT_SECRET exists?', !!process.env.JWT_SECRET);
    console.log('JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN);

    const token = jwt.sign(
        { id, usertype, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    console.log('Token generated successfully');
    return token;
};

module.exports = generateToken;