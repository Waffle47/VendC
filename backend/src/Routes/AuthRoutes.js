const express = require('express');
const router = express.Router();
const { registerRetailer, registerWholesaler, login } = require('../Controllers/AuthController');

// Authentication routes
router.post('/register/retailer', registerRetailer);
router.post('/register/wholesaler', registerWholesaler);
router.post('/login', login);

module.exports = router;