# VendConnect - B2B E-Commerce Platform

## Overview

VendConnect is a comprehensive B2B e-commerce platform connecting wholesalers and retailers through a seamless, role-based digital marketplace.

## Technology Stack

### Frontend

- React 18 with Vite
- React Router for navigation
- Socket.IO Client for real-time chat
- Axios for API calls
- React Icons for UI elements

### Backend

- Node.js with Express
- Socket.IO for real-time communication
- MySQL for database
- JWT for authentication
- Bcrypt for password hashing
- Multer for file uploads

### Payment Integration

- M-Pesa (Daraja API)
- Stripe

## Features

### For Retailers

- Product browsing and search
- Shopping cart management
- Checkout with M-Pesa and Credit
- Order tracking
- Credit management
- Wishlist
- Product reviews
- Real-time chat with wholesalers

### For Wholesalers

- Product management (CRUD)
- Inventory tracking
- Order fulfillment
- Shipping configuration
- Dynamic pricing with tiered discounts
- Bulk product upload
- Real-time chat with retailers

### For Admins

- User management
- Wholesaler verification
- Product moderation
- Order monitoring
- Dispute resolution
- Platform settings
- Activity logs

## Installation

### Prerequisites

- Node.js (v16+)
- MySQL (v8.0+)
- npm or yarn

### Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update .env with your credentials
# Run database migrations (if applicable)
npm run migrate

# Start development server
npm run dev
```
