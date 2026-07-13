import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import * as icons from 'react-icons/lu';
import '../styling/RetailerDashboard.css';
import ProfileSettings from '../components/ProfileSettings';
import API from '../api/axiosConfig';
import ChatModule from '../components/ChatModule';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';




function RetailerDashboard() {
    const { user, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeMenu, setActiveMenu] = useState('marketplace');

    // Redirect if not retailer
    if (!user || user.userType !== 'retailer') {
        window.location.href = '/login';
        return null;
    }

    // Retailer Menu Items
    const menuItems = [
        { id: 'marketplace', label: 'Marketplace', icon: icons.LuShoppingBag },
        { id: 'my-orders', label: 'My Orders', icon: icons.LuTruck },
        { id: 'cart', label: 'Cart', icon: icons.LuShoppingCart },
        { id: 'wishlist', label: 'Wishlist', icon: icons.LuHeart },
        { id: 'reviews', label: 'My Reviews', icon: icons.LuStar },
        { id: 'profile', label: 'My Profile', icon: icons.LuUser },
        { id: 'credit', label: 'Credit Profile', icon: icons.LuCreditCard },
        { id: 'invoices', label: 'Invoices', icon: icons.LuFileText },
        { id: 'chat', label: 'Chat', icon: icons.LuMessageCircle },
    ];

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const renderContent = () => {
        switch (activeMenu) {
            case 'marketplace':
                return <MarketplaceSection />;
            case 'my-orders':
                return <MyOrdersSection />;
            case 'cart':
                return <CartSection />;
            case 'wishlist':
                return <WishlistSection />;
            case 'reviews':
                return <MyReviewsSection user={user} />;
            case 'profile':
                return <ProfileSection user={user} />;
            case 'credit':
                return <CreditProfileSection />;
            case 'invoices':
                return <InvoicesSection />;
            case 'chat':
                return <ChatModule />;
            default:
                return <MarketplaceSection />;
        }
    };

    return (
        <div className="retailer-dashboard">
            <Sidebar
                isOpen={sidebarOpen}
                onToggle={toggleSidebar}
                activeMenu={activeMenu}
                onMenuClick={setActiveMenu}
                user={user}
                onLogout={logout}
                menuItems={menuItems}
            />

            <div className={`retailer-main ${sidebarOpen ? 'retailer-main-expanded' : 'retailer-main-collapsed'}`}>
                <div className="retailer-topbar">
                    <h1 className="retailer-page-title">
                        {menuItems.find(item => item.id === activeMenu)?.label || 'Marketplace'}
                    </h1>
                </div>
                <div className="retailer-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}

// ============================================
// PROFILE SECTION
// ============================================

function ProfileSection({ user }) {
    const [showProfileModal, setShowProfileModal] = useState(true);

    return (
        <div className="retailer-profile">
            {showProfileModal && (
                <ProfileSettings
                    user={user}
                    isModal={false}
                    onClose={() => setShowProfileModal(false)}
                    onUpdate={() => window.location.reload()}
                />
            )}
        </div>
    );
}

// ============================================
// MARKETPLACE SECTION
// ============================================

function MarketplaceSection() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    const [categories, setCategories] = useState([]);
    const [addingToCart, setAddingToCart] = useState(null);
    const [cartMessage, setCartMessage] = useState(null);
    const [cartItemCount, setCartItemCount] = useState(0);
    const [showReviewsModal, setShowReviewsModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productReviewsList, setProductReviewsList] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [productReviews, setProductReviews] = useState({});



    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchCartSummary();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await API.get('/products');
            console.log(' Products API response:', response.data);
            // Log image URLs specifically
            response.data.forEach(p => {
                console.log(` ${p.name}: imageUrl =`, p.imageUrl);
            });
            setProducts(response.data);
        } catch (error) {
            console.error('Fetch products error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            //  Use the same endpoint that works in wholesaler dashboard
            const response = await API.get('/products/categories-list');
            setCategories(response.data);
        } catch (error) {
            console.error('Fetch categories error:', error);
            // Don't let categories error break the page
            setCategories([]);
        }
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !selectedCategory || product.category_id === parseInt(selectedCategory);
        const matchesPrice = (!priceRange.min || product.base_price >= parseFloat(priceRange.min)) &&
            (!priceRange.max || product.base_price <= parseFloat(priceRange.max));
        return matchesSearch && matchesCategory && matchesPrice;
    });

    // In the addToCart function, replace the cartMessage state with alert
    const addToCart = async (product, quantity = 1) => {
        setAddingToCart(product.product_id);
        try {
            const response = await API.post('/cart/add', {
                product_id: product.product_id,
                quantity: quantity,
                unit_price: product.base_price
            });

            //  Browser alert instead of div message
            alert(response.data.message);

            fetchCartSummary();
        } catch (error) {
            console.error('Add to cart error:', error);
            alert(error.response?.data?.message || 'Failed to add to cart');
        } finally {
            setAddingToCart(null);
        }
    };

    // Fetch cart summary for badge count
    const fetchCartSummary = async () => {
        try {
            const response = await API.get('/cart/summary');
            setCartItemCount(response.data.item_count);
        } catch (error) {
            console.error('Fetch cart summary error:', error);
        }
    };

    const addToWishlist = async (productId) => {
        try {
            await API.post('/wishlist/add', { product_id: productId });
            alert('Added to wishlist!');
        } catch (error) {
            console.error('Add to wishlist error:', error);
        }
    };

    if (loading) {
        return <div className="retailer-placeholder">Loading products...</div>;
    }

    // Fetch product reviews
    const fetchProductReviews = async (product) => {
        setReviewsLoading(true);
        try {
            // Fetch reviews for this product
            const response = await API.get(`/reviews/product/${product.product_id}`);
            setProductReviewsList(response.data.reviews || []);
            setSelectedProduct(product);
            setShowReviewsModal(true);
        } catch (error) {
            console.error('Fetch product reviews error:', error);
            alert('Failed to load reviews');
        } finally {
            setReviewsLoading(false);
        }
    };

    // Open reviews modal
    const openReviewsModal = (product) => {
        fetchProductReviews(product);
    };


    // Ask about product - initiates chat with wholesaler
    const initiateChat = async (wholesalerId, productId, productName) => {
        try {
            // Check if conversation exists, if not create one
            const response = await API.post('/chat/initiate', {
                wholesaler_id: wholesalerId,
                product_id: productId,
                initial_message: `Hi, I'm interested in your product "${productName}". Can you tell me more about it?`
            });

            // Redirect to messages section
            alert('Message sent to wholesaler! Check your messages.');
            // You can also navigate to messages tab here
        } catch (error) {
            console.error('Initiate chat error:', error);
            alert('Failed to start chat. Please try again.');
        }
    };

    //helper for images 
    const getImageUrl = (imagePath) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http')) return imagePath;
        // Handle both /uploads/... and uploads/... formats
        const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
        return `http://localhost:5000${cleanPath}`;
    };

    return (
        <div className="retailer-marketplace">
            {/* Search and Filters */}
            <div className="retailer-filters">
                <div className="retailer-search">
                    <icons.LuSearch size={20} />
                    <input
                        type="text"
                        placeholder="Search products by name or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="retailer-filter-group">
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                        ))}
                    </select>

                    <input
                        type="number"
                        placeholder="Min Price (KES)"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Max Price (KES)"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                    />
                </div>
            </div>

            {/* Products Grid */}
            <div className="retailer-products-grid">
                {filteredProducts.length === 0 ? (
                    <div className="retailer-placeholder">No products found</div>
                ) : (
                    filteredProducts.map(product => (
                        <div key={product.product_id} className="retailer-product-card">
                            <div className="retailer-product-image">
                                {product.imageUrl ? (
                                    <img
                                        src={getImageUrl(product.imageUrl)}
                                        alt={product.name}
                                        onError={(e) => {
                                            console.log('Image failed to load:', product.imageUrl);
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = '<div class="retailer-product-image-placeholder"><svg ...></svg></div>';
                                        }}
                                    />
                                ) : (
                                    <div className="retailer-product-image-placeholder">
                                        <icons.LuPackage size={48} />
                                    </div>
                                )}
                            </div>
                            <div className="retailer-product-info">
                                <h3>{product.name}</h3>
                                <p className="retailer-product-price">KES {product.base_price?.toLocaleString()}</p>
                                <p className="retailer-product-supplier">{product.supplier_name}</p>

                                {/* ✅ Reviews Section */}
                                <div className="retailer-product-reviews">
                                    {productReviews[product.product_id]?.average_rating > 0 ? (
                                        <div className="retailer-product-rating">
                                            <span className="retailer-rating-stars">
                                                {'⭐'.repeat(Math.round(productReviews[product.product_id].average_rating))}
                                                {'☆'.repeat(5 - Math.round(productReviews[product.product_id].average_rating))}
                                            </span>
                                            <span className="retailer-rating-count">
                                                ({productReviews[product.product_id].total_reviews} reviews)
                                            </span>
                                            <button
                                                className="retailer-view-reviews-btn"
                                                onClick={() => openReviewsModal(product)}
                                            >
                                                View Reviews
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="retailer-product-rating">
                                            <span className="retailer-no-reviews">No reviews yet</span>
                                            <button
                                                className="retailer-be-first-btn"
                                                onClick={() => openReviewsModal(product)}
                                            >
                                                Product reviews
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="retailer-product-shipping">
                                    {product.shipping_cost > 0 ? (
                                        <span className="shipping-cost">
                                            Shipping: KES {product.shipping_cost?.toLocaleString()}
                                            {product.shipping_per_unit && ' per unit'}
                                        </span>
                                    ) : (
                                        <span className="shipping-free">Free Shipping</span>
                                    )}
                                    {product.free_shipping_threshold > 0 && (
                                        <span className="shipping-threshold">
                                            Free shipping over KES {product.free_shipping_threshold?.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="retailer-product-actions">
                                    <button onClick={() => addToCart(product)} className="retailer-btn-cart">
                                        <icons.LuShoppingCart size={16} /> Add to Cart
                                    </button>
                                    <button onClick={() => addToWishlist(product.product_id)} className="retailer-btn-wishlist">
                                        <icons.LuHeart size={16} />
                                    </button>
                                    <button
                                        onClick={() => initiateChat(product.wholesaler_id, product.product_id, product.name)}
                                        className="retailer-btn-chat"
                                        title="Ask about this product"
                                    >
                                        <icons.LuMessageCircle size={16} /> Ask
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Reviews Modal */}
            {showReviewsModal && selectedProduct && (
                <div className="reviews-modal-overlay" onClick={() => setShowReviewsModal(false)}>
                    <div className="reviews-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="reviews-modal-header">
                            <h3>Reviews for {selectedProduct.name}</h3>
                            <button className="reviews-modal-close" onClick={() => setShowReviewsModal(false)}>×</button>
                        </div>
                        <div className="reviews-modal-body">
                            {reviewsLoading ? (
                                <div className="reviews-loading">Loading reviews...</div>
                            ) : productReviewsList.length === 0 ? (
                                <div className="reviews-empty">
                                    <icons.LuStar size={48} />
                                    <p>No reviews yet. Be the first to review this product!</p>
                                </div>
                            ) : (
                                <div className="reviews-list">
                                    {productReviewsList.map(review => (
                                        <div key={review.review_id} className="review-item">
                                            <div className="review-item-header">
                                                <span className="review-item-retailer">{review.retailer_name}</span>
                                                <div className="review-item-rating">
                                                    {'⭐'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                                </div>
                                            </div>
                                            {review.title && <p className="review-item-title">{review.title}</p>}
                                            {review.comment && <p className="review-item-comment">{review.comment}</p>}
                                            <p className="review-item-date">{new Date(review.created_at).toLocaleDateString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// MY ORDERS SECTION
// ============================================

function MyOrdersSection() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await API.get('/orders/my-orders');
            setOrders(response.data);
        } catch (error) {
            console.error('Fetch orders error:', error);
        } finally {
            setLoading(false);
        }
    };

    //  Format date function
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'delivered': return 'retailer-status-delivered';
            case 'shipped': return 'retailer-status-shipped';
            case 'processing': return 'retailer-status-processing';
            case 'pending': return 'retailer-status-pending';
            case 'cancelled': return 'retailer-status-cancelled';
            default: return 'retailer-status-pending';
        }
    };

    const fetchOrderDetails = async (orderId) => {
        setLoading(true);
        try {
            const response = await API.get(`/orders/${orderId}`);
            setSelectedOrder(response.data);
        } catch (error) {
            console.error('Fetch order details error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="retailer-placeholder">Loading orders...</div>;
    }

    return (
        <div className="retailer-orders">
            {selectedOrder ? (
                <>
                    <button className="retailer-back-btn" onClick={() => setSelectedOrder(null)}>
                        ← Back to Orders
                    </button>
                    <div className="retailer-order-detail">
                        <h2>Order #{selectedOrder.order_number}</h2>
                        <p>Placed on: {formatDate(selectedOrder.ordered_at)}</p>
                        <p>Status: <span className={getStatusBadgeClass(selectedOrder.status)}>{selectedOrder.status}</span></p>
                        <p>Total: KES {selectedOrder.total_amount?.toLocaleString()}</p>
                        <h3>Items</h3>
                        <table className="retailer-order-items-table">
                            <thead>
                                <tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr>
                            </thead>
                            <tbody>
                                {selectedOrder.items?.map(item => (
                                    <tr key={item.order_item_id}>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity}</td>
                                        <td>KES {item.unit_price?.toLocaleString()}</td>
                                        <td>KES {item.total_price?.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : orders.length === 0 ? (
                <div className="retailer-placeholder">
                    <icons.LuTruck size={48} />
                    <h3>No Orders Yet</h3>
                    <p>Start shopping to see your orders here.</p>
                </div>
            ) : (
                <div className="retailer-orders-list">
                    {orders.map(order => (
                        <div key={order.order_id} className="retailer-order-card" onClick={() => fetchOrderDetails(order.order_id)}>
                            <div className="retailer-order-header">
                                <span className="retailer-order-number">#{order.order_number}</span>
                                <span className={getStatusBadgeClass(order.status)}>{order.status}</span>
                            </div>
                            <div className="retailer-order-details">
                                <p>Date: {formatDate(order.ordered_at)}</p>
                                <p>Total: KES {order.total_amount?.toLocaleString()}</p>
                                <p>Items: {order.item_count || 0}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// CART SECTION WITH PAYMENT & CREDIT
// ============================================

function CartSection() {
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [mpesaPhone, setMpesaPhone] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);
    const [creditRequestSent, setCreditRequestSent] = useState(false);
    const [message, setMessage] = useState('');
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [paymentMessage, setPaymentMessage] = useState('');
    const [currentOrderId, setCurrentOrderId] = useState(null);

    useEffect(() => {
        fetchCart();
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.phone) {
            setMpesaPhone(user.phone);
        }
    }, []);

    const fetchCart = async () => {
        setLoading(true);
        try {
            const response = await API.get('/cart');
            setCartItems(response.data);
        } catch (error) {
            console.error('Fetch cart error:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = async (cartId, quantity) => {
        if (quantity < 1) return;
        try {
            await API.put(`/cart/update/${cartId}`, { quantity });
            fetchCart();
        } catch (error) {
            console.error('Update quantity error:', error);
            alert(error.response?.data?.message || 'Failed to update quantity');
        }
    };

    const removeItem = async (cartId) => {
        try {
            await API.delete(`/cart/remove/${cartId}`);
            fetchCart();
        } catch (error) {
            console.error('Remove item error:', error);
            alert('Failed to remove item');
        }
    };

    const calculateShipping = (items) => {
        let totalShipping = 0;
        let subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        for (const item of items) {
            if (item.free_shipping_threshold && subtotal >= item.free_shipping_threshold) {
                continue;
            }
            if (item.shipping_per_unit) {
                totalShipping += (item.shipping_cost || 0) * item.quantity;
            } else {
                totalShipping += (item.shipping_cost || 0);
            }
        }
        return totalShipping;
    };

    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const shipping = calculateShipping(cartItems);
    const total = subtotal + shipping;

    const groupByWholesaler = () => {
        const grouped = {};
        cartItems.forEach(item => {
            if (!grouped[item.wholesaler_id]) {
                grouped[item.wholesaler_id] = {
                    wholesaler_name: item.wholesaler_name,
                    items: [],
                    subtotal: 0
                };
            }
            grouped[item.wholesaler_id].items.push(item);
            grouped[item.wholesaler_id].subtotal += item.quantity * item.unit_price;
        });
        return grouped;
    };

    const validatePhoneNumber = (phone) => {
        const cleaned = phone.toString().replace(/\D/g, '');
        if (cleaned.length === 10 && cleaned.startsWith('0')) return true;
        if (cleaned.length === 12 && cleaned.startsWith('254')) return true;
        if (cleaned.length === 9 && cleaned.startsWith('7')) return true;
        return false;
    };

    const createOrder = async () => {
        const formattedCartItems = cartItems.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku || 'N/A',
            quantity: item.quantity,
            unit_price: item.unit_price,
            wholesaler_id: item.wholesaler_id
        }));

        const orderResponse = await API.post('/orders/create', {
            items: formattedCartItems,
            subtotal: subtotal,
            shipping: shipping,
            total: total
        });

        setCurrentOrderId(orderResponse.data.order_id);
        return orderResponse.data.order_id;
    };

    //  M-Pesa (Daraja) Payment Handler
    const handleMpesaPayment = async () => {
        if (!mpesaPhone || !validatePhoneNumber(mpesaPhone)) {
            alert('Please enter a valid M-Pesa phone number (e.g., 0712345678)');
            return;
        }

        setProcessingPayment(true);
        setPaymentStatus('processing');
        setPaymentMessage('Creating order...');

        try {
            //  Create order FIRST
            const orderId = await createOrder();
            setPaymentMessage('Order created. Processing payment...');

            // Initiate M-Pesa payment
            const paymentResponse = await API.post('/payments/mpesa/stkpush', {
                order_id: orderId,
                amount: total,
                phone_number: mpesaPhone
            });

            // If STK push was successful (ResponseCode: "0"), mark as paid for demo
            if (paymentResponse.data.success) {
                setPaymentStatus('success');
                setPaymentMessage('Payment successful! Your order has been placed.');

                // Manually update order to paid (for demo purposes)
                await API.put(`/orders/${orderId}/status`, { payment_status: 'paid' });

                setTimeout(async () => {
                    await API.delete('/cart/clear');
                    window.location.href = '/dashboard';
                }, 2000);
            } else {
                setPaymentStatus('failed');
                setPaymentMessage('Payment initiation failed. Please try again.');
                setProcessingPayment(false);
            }

        } catch (error) {
            console.error('Payment error:', error);
            setPaymentStatus('failed');
            setPaymentMessage(error.response?.data?.message || 'Payment failed. Please try again.');
            setProcessingPayment(false);
        }
    };

    // Handle credit request
    const handleRequestCredit = async (wholesalerId, wholesalerName, amount) => {
        setProcessingPayment(true);
        try {
            // Create order with credit payment method
            const formattedCartItems = cartItems.map(item => ({
                product_id: item.product_id,
                product_name: item.product_name,
                sku: item.sku || 'N/A',
                quantity: item.quantity,
                unit_price: item.unit_price,
                wholesaler_id: item.wholesaler_id
            }));

            // ✅ Create order with payment_method = 'credit' and payment_status = 'credit_pending'
            const orderResponse = await API.post('/orders/create', {
                items: formattedCartItems,
                subtotal: subtotal,
                shipping: shipping,
                total: total,
                payment_method: 'credit',      // ← Add this
                payment_status: 'credit_pending' // ← Add this
            });

            const orderId = orderResponse.data.order_id;

            // Send credit request
            const response = await API.post('/credit/request', {
                wholesaler_id: wholesalerId,
                amount: amount,
                order_id: orderId
            });

            if (response.data.success) {
                alert(`✅ Credit request sent successfully to ${wholesalerName}!\n\nAmount: KES ${amount.toLocaleString()}\n\nThe wholesaler will review your request.`);

                setTimeout(async () => {
                    await API.delete('/cart/clear');
                    window.location.href = '/dashboard';
                }, 3000);
            }
        } catch (error) {
            console.error('Credit request error:', error);
            alert('❌ Credit request failed: ' + (error.response?.data?.message || 'Please try again'));
            setProcessingPayment(false);
        }
    };

    const groupedCart = groupByWholesaler();

    if (loading) {
        return <div className="retailer-placeholder">Loading cart...</div>;
    }

    return (
        <div className="retailer-cart">
            {cartItems.length === 0 ? (
                <div className="retailer-placeholder">
                    <icons.LuShoppingCart size={48} />
                    <h3>Your Cart is Empty</h3>
                    <p>Start shopping to add items to your cart.</p>
                    <button className="retailer-btn-primary" onClick={() => window.location.href = '/dashboard'}>
                        Continue Shopping
                    </button>
                </div>
            ) : (
                <>
                    <div className="retailer-cart-items">
                        <table className="retailer-cart-table">
                            <thead>
                                <tr><th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th></th></tr>
                            </thead>
                            <tbody>
                                {cartItems.map(item => (
                                    <tr key={item.cart_id}>
                                        <td>{item.product_name}</td>
                                        <td>KES {item.unit_price?.toLocaleString()}</td>
                                        <td>
                                            <input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.cart_id, parseInt(e.target.value))} min="1" />
                                        </td>
                                        <td>KES {(item.quantity * item.unit_price).toLocaleString()}</td>
                                        <td><button onClick={() => removeItem(item.cart_id)} className="retailer-btn-remove">Remove</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="retailer-cart-summary">
                        <h3>Order Summary</h3>
                        <div className="retailer-summary-row"><span>Subtotal:</span><span>KES {subtotal.toLocaleString()}</span></div>
                        <div className="retailer-summary-row"><span>Shipping:</span><span>{shipping === 0 ? 'FREE' : `KES ${shipping.toLocaleString()}`}</span></div>
                        <div className="retailer-summary-row retailer-summary-total"><span>Total:</span><span>KES {total.toLocaleString()}</span></div>
                        <button className="retailer-btn-checkout" onClick={() => setShowPaymentModal(true)}>Proceed to Checkout</button>
                    </div>
                </>
            )}

            {/* Payment Options Modal */}
            {showPaymentModal && !selectedPaymentMethod && (
                <div className="payment-modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="payment-modal-header">
                            <h3>Choose Payment Method</h3>
                            <button className="payment-modal-close" onClick={() => setShowPaymentModal(false)}>×</button>
                        </div>
                        <div className="payment-modal-body">
                            <div className="payment-amount"><h4>Total Amount: KES {total.toLocaleString()}</h4></div>
                            <div className="payment-options">
                                <div className="payment-option-group">
                                    <h4>Pay Now</h4>
                                    <div className="payment-buttons">
                                        <button className="payment-btn mpesa" onClick={() => setSelectedPaymentMethod('mpesa')}>
                                            <icons.LuSmartphone size={20} /> M-Pesa
                                        </button>
                                    </div>
                                </div>
                                <div className="payment-divider">OR</div>
                                <div className="payment-option-group">
                                    <h4>Request Credit</h4>
                                    <p className="credit-info">Request credit from wholesalers. They will review and approve or reject your request.</p>
                                    {Object.entries(groupedCart).map(([wholesalerId, group]) => (
                                        <div key={wholesalerId} className="credit-wholesaler-option">
                                            <div className="credit-wholesaler-info">
                                                <strong>{group.wholesaler_name}</strong>
                                                <span>Amount: KES {group.subtotal.toLocaleString()}</span>
                                            </div>
                                            <button className="credit-request-btn" onClick={() => handleRequestCredit(wholesalerId, group.wholesaler_name, group.subtotal)} disabled={processingPayment}>
                                                Request Credit from {group.wholesaler_name}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* M-Pesa Phone Number Container */}
            {selectedPaymentMethod === 'mpesa' && (
                <div className="payment-modal-overlay" onClick={() => { setSelectedPaymentMethod(null); setShowPaymentModal(true); }}>
                    <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="payment-modal-header">
                            <h3>M-Pesa Payment</h3>
                            <button className="payment-modal-close" onClick={() => { setSelectedPaymentMethod(null); setShowPaymentModal(true); }}>×</button>
                        </div>
                        <div className="payment-modal-body">
                            <div className="payment-amount"><h4>Amount: KES {total.toLocaleString()}</h4></div>
                            <div className="mpesa-container">
                                <label className="mpesa-label">M-Pesa Phone Number</label>
                                <div className="mpesa-input-wrapper">
                                    <span className="mpesa-prefix">+254</span>
                                    <input type="tel" className="mpesa-input" placeholder="712345678" value={mpesaPhone.replace(/^\+254|^254|^0/, '')} onChange={(e) => { let value = e.target.value.replace(/\D/g, ''); setMpesaPhone(value); }} autoFocus />
                                </div>
                                <p className="mpesa-hint">Enter your M-Pesa number (e.g., 0712345678)</p>
                                <p className="mpesa-hint"><small>Test number for sandbox: 254708374149</small></p>
                            </div>
                            <div className="payment-actions">
                                <button className="payment-btn-back" onClick={() => { setSelectedPaymentMethod(null); setShowPaymentModal(true); }}>Back</button>
                                <button className="payment-btn-confirm" onClick={handleMpesaPayment} disabled={processingPayment}>
                                    {processingPayment ? 'Processing...' : `Pay KES ${total.toLocaleString()}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Status Modal */}
            {paymentStatus && (
                <div className="payment-status-overlay">
                    <div className="payment-status-modal">
                        {paymentStatus === 'processing' && (
                            <div className="payment-status-processing">
                                <div className="payment-spinner"></div>
                                <h3>Processing Payment</h3>
                                <p>{paymentMessage}</p>
                                <p className="payment-status-hint">Please do not close this window</p>
                            </div>
                        )}
                        {paymentStatus === 'success' && (
                            <div className="payment-status-success">
                                <div className="payment-success-icon">✓</div>
                                <h3>Payment Successful!</h3>
                                <p>{paymentMessage}</p>
                                <p className="payment-status-hint">Redirecting to dashboard...</p>
                            </div>
                        )}
                        {paymentStatus === 'failed' && (
                            <div className="payment-status-failed">
                                <div className="payment-failed-icon">✗</div>
                                <h3>Payment Failed</h3>
                                <p>{paymentMessage}</p>
                                <button className="payment-status-btn" onClick={() => { setPaymentStatus(null); setProcessingPayment(false); }}>Try Again</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

//=============================================
// WISHLIST SECTION
//=============================================
function WishlistSection() {
    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWishlist();
    }, []);

    const fetchWishlist = async () => {
        setLoading(true);
        try {
            const response = await API.get('/wishlist');
            setWishlistItems(response.data);
        } catch (error) {
            console.error('Fetch wishlist error:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = async (productId) => {
        try {
            await API.post('/cart/add', { product_id: productId, quantity: 1 });
            alert('Added to cart!');
        } catch (error) {
            console.error('Add to cart error:', error);
        }
    };

    const removeFromWishlist = async (wishlistId) => {
        try {
            await API.delete(`/wishlist/remove/${wishlistId}`);
            fetchWishlist();
        } catch (error) {
            console.error('Remove from wishlist error:', error);
        }
    };

    if (loading) {
        return <div className="retailer-placeholder">Loading wishlist...</div>;
    }

    return (
        <div className="retailer-wishlist">
            {wishlistItems.length === 0 ? (
                <div className="retailer-placeholder">
                    <icons.LuHeart size={48} />
                    <h3>Your Wishlist is Empty</h3>
                    <p>Save products you love to your wishlist.</p>
                    <button className="retailer-btn-primary" onClick={() => window.location.href = '/dashboard'}>
                        Start Shopping
                    </button>
                </div>
            ) : (
                <div className="retailer-wishlist-grid">
                    {wishlistItems.map(item => (
                        <div key={item.wishlist_id} className="retailer-wishlist-card">
                            <div className="retailer-wishlist-image">
                                {item.product_image ? (
                                    <img src={item.product_image} alt={item.product_name} />
                                ) : (
                                    <icons.LuPackage size={48} />
                                )}
                            </div>
                            <div className="retailer-wishlist-info">
                                <h3>{item.product_name}</h3>
                                <p>KES {item.product_price?.toLocaleString()}</p>
                                <div className="retailer-wishlist-actions">
                                    <button onClick={() => addToCart(item.product_id)} className="retailer-btn-cart">
                                        Add to Cart
                                    </button>
                                    <button onClick={() => removeFromWishlist(item.wishlist_id)} className="retailer-btn-remove">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// CHECKOUT SECTION
// ============================================

function CheckoutSection({ cartItems, onClose }) {
    const [paymentMethod, setPaymentMethod] = useState('mpesa');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [useCredit, setUseCredit] = useState(false);
    const [creditAvailable, setCreditAvailable] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const shipping = subtotal > 10000 ? 0 : 200;
    const total = subtotal + shipping;

    useEffect(() => {
        checkCreditEligibility();
    }, []);

    const checkCreditEligibility = async () => {
        try {
            // Get credit profile for first wholesaler in cart
            const wholesalerId = cartItems[0]?.wholesaler_id;
            if (wholesalerId) {
                const response = await API.post('/credit/check', {
                    wholesaler_id: wholesalerId,
                    amount: total
                });
                setCreditAvailable(response.data.available_credit || 0);
            }
        } catch (error) {
            console.error('Check credit error:', error);
        }
    };

    const handlePayment = async () => {
        setLoading(true);
        setMessage('');

        try {
            let response;

            if (paymentMethod === 'mpesa') {
                response = await API.post('/payment/mpesa/stkpush', {
                    order_id: 'temp', // Replace with actual order ID
                    amount: total,
                    phone_number: phoneNumber
                });
            } else if (paymentMethod === 'card') {
                response = await API.post('/payment/card/pay', {
                    order_id: 'temp',
                    amount: total
                });
            } else if (paymentMethod === 'credit') {
                response = await API.post('/credit/apply', {
                    order_id: 'temp',
                    wholesaler_id: cartItems[0]?.wholesaler_id,
                    amount: total
                });
            }

            setMessage({ type: 'success', text: 'Payment successful! Redirecting...' });
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Payment failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="checkout-overlay">
            <div className="checkout-modal">
                <div className="checkout-header">
                    <h2>Checkout</h2>
                    <button onClick={onClose}>×</button>
                </div>

                <div className="checkout-body">
                    <div className="checkout-summary">
                        <h3>Order Summary</h3>
                        <div>Subtotal: KES {subtotal.toLocaleString()}</div>
                        <div>Shipping: {shipping === 0 ? 'FREE' : `KES ${shipping}`}</div>
                        <div className="checkout-total">Total: KES {total.toLocaleString()}</div>
                    </div>

                    <div className="payment-methods">
                        <h3>Select Payment Method</h3>

                        <label className="payment-option">
                            <input
                                type="radio"
                                name="payment"
                                value="mpesa"
                                checked={paymentMethod === 'mpesa'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            />
                            <span>📱 M-Pesa</span>
                        </label>

                        <label className="payment-option">
                            <input
                                type="radio"
                                name="payment"
                                value="card"
                                checked={paymentMethod === 'card'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            />
                            <span>💳 Card (Visa/Mastercard)</span>
                        </label>

                        <label className="payment-option">
                            <input
                                type="radio"
                                name="payment"
                                value="credit"
                                checked={paymentMethod === 'credit'}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                disabled={creditAvailable < total}
                            />
                            <span>🏦 Credit (Pay in 30 days) - Available: KES {creditAvailable.toLocaleString()}</span>
                        </label>
                    </div>

                    {paymentMethod === 'mpesa' && (
                        <div className="payment-details">
                            <label>M-Pesa Phone Number</label>
                            <input
                                type="tel"
                                placeholder="0712345678"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                            <small>You will receive an STK push on this number</small>
                        </div>
                    )}

                    {message && (
                        <div className={`checkout-message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        className="checkout-btn"
                        onClick={handlePayment}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : `Pay KES ${total.toLocaleString()}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// MY REVIEWS SECTION
// ============================================
function MyReviewsSection({ user }) {
    const [reviews, setReviews] = useState([]);
    const [deliveredOrders, setDeliveredOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewTitle, setReviewTitle] = useState('');
    const [reviewComment, setReviewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchReviews();
        fetchDeliveredOrders();
    }, []);

    const fetchReviews = async () => {
        console.log('Fetching reviews...');
        try {
            const response = await API.get('/reviews/my-reviews');
            console.log('Reviews response:', response.data);
            setReviews(response.data);
        } catch (error) {
            console.error('Fetch reviews error:', error.response?.status, error.response?.data);
        }
    };

    const fetchDeliveredOrders = async () => {
        console.log('Fetching delivered orders...');
        try {
            const response = await API.get('/orders/my-orders');
            console.log('Orders response:', response.data);
            const delivered = response.data.filter(order => order.status === 'delivered');
            console.log('Delivered orders:', delivered);

            // Get already reviewed order IDs
            const reviewsResponse = await API.get('/reviews/my-reviews');
            const reviewedOrderIds = reviewsResponse.data.map(review => review.order_id);
            console.log('Reviewed order IDs:', reviewedOrderIds);

            const unreviewedOrders = delivered.filter(order => !reviewedOrderIds.includes(order.order_id));
            console.log('Unreviewed orders:', unreviewedOrders);

            setDeliveredOrders(unreviewedOrders);
        } catch (error) {
            console.error('Fetch delivered orders error:', error.response?.status, error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const deleteReview = async (reviewId) => {
        if (window.confirm('Are you sure you want to delete this review?')) {
            try {
                await API.delete(`/reviews/${reviewId}`);
                fetchReviews();
            } catch (error) {
                console.error('Delete review error:', error);
            }
        }
    };

    const submitReview = async () => {
        if (rating === 0) {
            alert('Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            await API.post('/reviews/create', {
                order_id: selectedOrder.order_id,
                rating: rating,
                title: reviewTitle,
                comment: reviewComment
            });
            alert('Review submitted successfully!');
            setShowReviewModal(false);
            setRating(0);
            setReviewTitle('');
            setReviewComment('');
            fetchReviews();
            fetchDeliveredOrders();
        } catch (error) {
            console.error('Submit review error:', error);
            alert(error.response?.data?.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return <div className="retailer-placeholder">Loading...</div>;
    }

    return (
        <div className="retailer-reviews">
            {/* Delivered Orders Section - Ready for Review */}
            {deliveredOrders.length > 0 && (
                <div className="retailer-delivered-orders">
                    <h3>Orders Ready for Review</h3>
                    <div className="retailer-delivered-list">
                        {deliveredOrders.map(order => (
                            <div key={order.order_id} className="retailer-delivered-card">
                                <div className="retailer-delivered-info">
                                    <span className="retailer-delivered-number">Order #{order.order_number}</span>
                                    <span className="retailer-delivered-date">{formatDate(order.ordered_at)}</span>
                                    <span className="retailer-delivered-total">KES {order.total_amount?.toLocaleString()}</span>
                                </div>
                                <button
                                    className="retailer-review-now-btn"
                                    onClick={() => {
                                        setSelectedOrder(order);
                                        setShowReviewModal(true);
                                    }}
                                >
                                    Leave a Review
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Existing Reviews Section */}
            <div className="retailer-reviews-section">
                <h3>My Reviews</h3>
                {reviews.length === 0 ? (
                    <div className="retailer-placeholder-small">
                        <icons.LuStar size={32} />
                        <p>No reviews yet. Leave a review for delivered orders!</p>
                    </div>
                ) : (
                    <div className="retailer-reviews-list">
                        {reviews.map(review => (
                            <div className="retailer-review-card">
                                <div className="retailer-review-header">
                                    <div>
                                        {/* Show both product name and wholesaler name */}
                                        <span className="retailer-review-product">
                                            {review.product_name || 'Product'}
                                        </span>
                                        <span className="retailer-review-wholesaler">
                                            from {review.wholesaler_name}
                                        </span>
                                        <div className="retailer-review-rating">
                                            {'⭐'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                        </div>
                                    </div>
                                    <button onClick={() => deleteReview(review.review_id)} className="retailer-btn-remove">
                                        Delete
                                    </button>
                                </div>
                                <p className="retailer-review-title">{review.title || 'No title'}</p>
                                <p className="retailer-review-comment">{review.comment || 'No comment'}</p>
                                <p className="retailer-review-date">{formatDate(review.created_at)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {showReviewModal && selectedOrder && (
                <div className="review-modal-overlay" onClick={() => setShowReviewModal(false)}>
                    <div className="review-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="review-modal-header">
                            <h3>Leave a Review</h3>
                            <button className="review-modal-close" onClick={() => setShowReviewModal(false)}>×</button>
                        </div>
                        <div className="review-modal-body">
                            <div className="review-order-info">
                                <p>Order #{selectedOrder.order_number}</p>
                                <p className="review-order-amount">Total: KES {selectedOrder.total_amount?.toLocaleString()}</p>
                            </div>

                            <div className="review-rating-section">
                                <label>Your Rating *</label>
                                <div className="review-stars">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            className={`review-star ${star <= (hoverRating || rating) ? 'active' : ''}`}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="review-form-group">
                                <label>Review Title (Optional)</label>
                                <input
                                    type="text"
                                    value={reviewTitle}
                                    onChange={(e) => setReviewTitle(e.target.value)}
                                    placeholder="Summarize your experience"
                                />
                            </div>

                            <div className="review-form-group">
                                <label>Your Review (Optional)</label>
                                <textarea
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    placeholder="Share your experience with this wholesaler..."
                                    rows="4"
                                />
                            </div>

                            <div className="review-form-actions">
                                <button type="button" onClick={() => setShowReviewModal(false)} className="review-cancel-btn">
                                    Cancel
                                </button>
                                <button type="button" onClick={submitReview} disabled={submitting} className="review-submit-btn">
                                    {submitting ? 'Submitting...' : 'Submit Review'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// CREDIT PROFILE SECTION (Retailer)
// ============================================

function CreditProfileSection() {
    const [creditProfiles, setCreditProfiles] = useState([]);
    const [creditHistory, setCreditHistory] = useState([]);
    const [creditScoreHistory, setCreditScoreHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWholesaler, setSelectedWholesaler] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('mpesa');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedWholesalerId, setSelectedWholesalerId] = useState(null);

    useEffect(() => {
        fetchCreditProfile();
        fetchCreditHistory();
        fetchCreditScoreHistory();
    }, []);

    const fetchCreditProfile = async () => {
        try {
            const response = await API.get('/credit/profile');
            setCreditProfiles(response.data);
        } catch (error) {
            console.error('Fetch credit profile error:', error);
        }
    };

    const fetchCreditHistory = async () => {
        try {
            const response = await API.get('/credit/history');
            setCreditHistory(response.data);
        } catch (error) {
            console.error('Fetch credit history error:', error);
        }
    };

    const fetchCreditScoreHistory = async () => {
        try {
            const response = await API.get('/credit/score-history');
            setCreditScoreHistory(response.data);
        } catch (error) {
            console.error('Fetch credit score history error:', error);
            // Fallback to mock data if endpoint doesn't exist
            setCreditScoreHistory([
                { date: '2025-01-01', score: 350 },
                { date: '2025-02-01', score: 420 },
                { date: '2025-03-01', score: 480 },
                { date: '2025-04-01', score: 510 },
                { date: '2025-05-01', score: 535 },
                { date: '2025-06-01', score: 550 },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const makeCreditPayment = async (wholesalerId, amount) => {
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            await API.post('/credit/pay', {
                wholesaler_id: wholesalerId,
                amount: amount,
                payment_method: paymentMethod
            });
            alert(`✅ Payment of KES ${parseFloat(amount).toLocaleString()} recorded successfully!`);
            setShowPaymentModal(false);
            setPaymentAmount('');
            fetchCreditProfile();
            fetchCreditHistory();
        } catch (error) {
            console.error('Credit payment error:', error);
            alert('❌ Payment failed: ' + (error.response?.data?.message || 'Please try again'));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Calculate overall credit score (average across all wholesalers or global score)
    const overallCreditScore = creditProfiles.length > 0
        ? Math.round(creditProfiles.reduce((sum, p) => sum + (p.credit_score || 500), 0) / creditProfiles.length)
        : 500;

    // Prepare chart data
    const chartData = {
        labels: creditScoreHistory.map(item => formatDate(item.date)),
        datasets: [
            {
                label: 'Credit Score',
                data: creditScoreHistory.map(item => item.score),
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#e94560',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Credit Score Trend (Last 6 Months)',
                font: {
                    size: 16,
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => `Credit Score: ${context.raw}`,
                },
            },
        },
        scales: {
            y: {
                min: 0,
                max: 1000,
                title: {
                    display: true,
                    text: 'Credit Score',
                },
                grid: {
                    color: '#e0e0e0',
                },
            },
            x: {
                title: {
                    display: true,
                    text: 'Date',
                },
            },
        },
    };

    // Get rating based on credit score
    const getCreditRating = (score) => {
        if (score >= 800) return { text: 'Excellent', color: '#28a745', icon: <icons.LuStar /> };
        if (score >= 700) return { text: 'Very Good', color: '#17a2b8', icon: <icons.LuCircleCheckBig /> };
        if (score >= 600) return { text: 'Good', color: '#ffc107', icon: <icons.LuThumbsUp /> };
        if (score >= 500) return { text: 'Fair', color: '#fd7e14', icon: <icons.LuAnnoyed /> };
        return { text: 'Poor', color: '#dc3545', icon: <icons.LuCircleChevronDown /> };
    };

    const rating = getCreditRating(overallCreditScore);

    if (loading) {
        return <div className="retailer-placeholder">Loading credit profile...</div>;
    }

    return (
        <div className="retailer-credit-profile-enhanced">
            {/* Header with Credit Score Card */}
            <div className="credit-score-header">
                <div className="credit-score-card">
                    <div className="credit-score-icon"> <icons.LuClipboardList size={50} /> </div>
                    <div className="credit-score-info">
                        <span className="credit-score-label">Your Credit Score</span>
                        <div className="credit-score-value" style={{ color: rating.color }}>
                            {overallCreditScore}
                        </div>
                        <div className="credit-score-rating" style={{ backgroundColor: rating.color }}>
                            {rating.icon} {rating.text}
                        </div>
                    </div>
                    <div className="credit-score-progress">
                        <div
                            className="credit-score-progress-bar"
                            style={{ width: `${overallCreditScore / 10}%`, backgroundColor: rating.color }}
                        />
                    </div>
                </div>
                <div className="credit-stats-cards">
                    <div className="credit-stat-mini">
                        <span className="stat-value">{creditProfiles.length}</span>
                        <span className="stat-label">Credit Accounts</span>
                    </div>
                    <div className="credit-stat-mini">
                        <span className="stat-value">
                            KES {creditProfiles.reduce((sum, p) => sum + (p.used_credit || 0), 0).toLocaleString()}
                        </span>
                        <span className="stat-label">Total Used</span>
                    </div>
                    <div className="credit-stat-mini">
                        <span className="stat-value">
                            KES {creditProfiles.reduce((sum, p) => sum + (p.credit_limit || 0), 0).toLocaleString()}
                        </span>
                        <span className="stat-label">Total Limit</span>
                    </div>
                </div>
            </div>

            {/* Credit Score Chart */}
            <div className="credit-chart-container">
                <Line data={chartData} options={chartOptions} height={300} />
            </div>

            {/* Credit Accounts Section */}
            <div className="credit-accounts-section">
                <h3>Credit Accounts</h3>
                {creditProfiles.length === 0 ? (
                    <div className="retailer-placeholder-small">
                        <icons.LuCreditCard size={48} style={{ opacity: 0.5, marginBottom: '15px' }} />
                        <h3>No Credit Accounts Yet</h3>
                        <p>You haven't been approved for credit with any wholesaler yet.</p>
                    </div>
                ) : (
                    <div className="credit-profiles-grid-enhanced">
                        {creditProfiles.map(profile => (
                            <div key={profile.profile_id} className="credit-profile-card-enhanced">
                                <div className="credit-profile-header-enhanced">
                                    <div className="wholesaler-info">
                                        <h4>{profile.wholesaler_name}</h4>
                                        <span className={`credit-status-badge ${profile.is_active ? 'active' : 'inactive'}`}>
                                            {profile.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="credit-score-small">
                                        Score: <strong>{profile.credit_score || 500}</strong>
                                    </div>
                                </div>

                                {/* Progress bars for credit usage */}
                                <div className="credit-usage-bar">
                                    <div className="usage-bar-label">
                                        <span>Used Credit</span>
                                        <span>Available Credit</span>
                                    </div>
                                    <div className="usage-bar">
                                        <div
                                            className="usage-bar-used"
                                            style={{ width: `${(profile.used_credit / profile.credit_limit) * 100}%` }}
                                        />
                                        <div
                                            className="usage-bar-available"
                                            style={{ width: `${(profile.available_credit / profile.credit_limit) * 100}%` }}
                                        />
                                    </div>
                                    <div className="usage-stats">
                                        <span className="used">KES {profile.used_credit?.toLocaleString()}</span>
                                        <span className="available">KES {profile.available_credit?.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="credit-stats-grid-enhanced">
                                    <div className="credit-stat-item">
                                        <span className="stat-label">Credit Limit</span>
                                        <span className="stat-value">KES {profile.credit_limit?.toLocaleString()}</span>
                                    </div>
                                    <div className="credit-stat-item">
                                        <span className="stat-label">Payment Terms</span>
                                        <span className="stat-value">{profile.payment_terms || 'net_30'}</span>
                                    </div>
                                </div>

                                <button
                                    className="credit-pay-btn-enhanced"
                                    onClick={() => {
                                        setSelectedWholesaler(profile);
                                        setShowPaymentModal(true);
                                    }}
                                >
                                    Make Payment
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Credit Transaction History */}
            <div className="credit-history-section-enhanced">
                <h3>Transaction History</h3>
                {creditHistory.length === 0 ? (
                    <div className="credit-history-empty">
                        <p>No credit transactions yet.</p>
                    </div>
                ) : (
                    <div className="credit-history-table-container">
                        <table className="credit-history-table-enhanced">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Wholesaler</th>
                                    <th>Amount</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {creditHistory.slice(0, 10).map(transaction => (
                                    <tr key={transaction.transaction_id}>
                                        <td>{formatDate(transaction.created_at)}</td>
                                        <td>{transaction.wholesaler_name}</td>
                                        <td className={transaction.type === 'payment' ? 'credit-payment' : 'credit-usage'}>
                                            KES {parseFloat(transaction.amount).toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`credit-type-badge-enhanced ${transaction.type}`}>
                                                {transaction.type === 'payment' ? '💳 Payment' :
                                                    transaction.type === 'credit_used' ? '🛒 Purchase' :
                                                        transaction.type === 'fee' ? '📋 Fee' : '⚙️ Adjustment'}
                                            </span>
                                        </td>
                                        <td>{transaction.description || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedWholesaler && (
                <div className="credit-payment-modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="credit-payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="credit-payment-header">
                            <h3>Make a Payment to {selectedWholesaler.wholesaler_name}</h3>
                            <button className="credit-payment-close" onClick={() => setShowPaymentModal(false)}>×</button>
                        </div>
                        <div className="credit-payment-body">
                            <div className="payment-info-enhanced">
                                <div className="payment-info-row">
                                    <span>Outstanding Balance:</span>
                                    <strong className="text-danger">KES {selectedWholesaler.used_credit?.toLocaleString()}</strong>
                                </div>
                                <div className="payment-info-row">
                                    <span>Available Credit:</span>
                                    <strong className="text-success">KES {selectedWholesaler.available_credit?.toLocaleString()}</strong>
                                </div>
                            </div>
                            <div className="payment-form-group">
                                <label>Payment Amount (KES)</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    min="1"
                                    max={selectedWholesaler.used_credit}
                                />
                            </div>
                            <div className="payment-form-group">
                                <label>Payment Method</label>
                                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                    <option value="mpesa">M-Pesa</option>
                                    <option value="card">Card</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                </select>
                            </div>
                            <div className="payment-actions-enhanced">
                                <button className="payment-cancel-btn" onClick={() => setShowPaymentModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="payment-submit-btn"
                                    onClick={() => makeCreditPayment(selectedWholesaler.wholesaler_id, paymentAmount)}
                                >
                                    Submit Payment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// INVOICES SECTION (Retailer)
// ============================================

function InvoicesSection() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const response = await API.get('/credit/my-invoices');
            setInvoices(response.data);
        } catch (error) {
            console.error('Fetch invoices error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoiceDetails = async (invoiceId) => {
        try {
            const response = await API.get(`/credit/invoices/${invoiceId}`);
            setSelectedInvoice(response.data);
        } catch (error) {
            console.error('Fetch invoice details error:', error);
            alert('Failed to load invoice details');
        }
    };

    const markAsPaid = async (invoiceId) => {
        if (window.confirm('Mark this invoice as paid? This will update your credit balance.')) {
            try {
                await API.put(`/credit/invoices/${invoiceId}/pay`);
                alert('Invoice marked as paid successfully!');
                fetchInvoices();
                setSelectedInvoice(null);
            } catch (error) {
                console.error('Mark as paid error:', error);
                alert('Failed to mark invoice as paid');
            }
        }
    };


    const downloadInvoice = async (invoice) => {
        // Create a temporary div with the invoice HTML
        const printContent = document.createElement('div');
        printContent.style.width = '800px';
        printContent.style.padding = '40px';
        printContent.style.backgroundColor = 'white';
        printContent.style.fontFamily = 'Arial, sans-serif';

        // Build the invoice HTML
        printContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e94560; padding-bottom: 20px;">
            <h1 style="color: rgb(239,129,10); margin: 0;">VENDCONNECT</h1>
            <p style="margin: 5px 0;">B2B Wholesale Platform</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; width: 45%;">
                <h3 style="margin-top: 0; color: rgb(239,129,10) ;">From:</h3>
                <p><strong>${invoice.wholesaler_name}</strong><br>
                Email: ${invoice.wholesaler_email || 'N/A'}<br>
                Phone: ${invoice.wholesaler_phone || 'N/A'}</p>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; width: 45%;">
                <h3 style="margin-top: 0; color: rgb(239,129,10);">Bill To:</h3>
                <p><strong>${invoice.retailer_name}</strong><br>
                Email: ${invoice.retailer_email || 'N/A'}<br>
                Phone: ${invoice.retailer_phone || 'N/A'}<br>
                Address: ${invoice.retailer_address || 'N/A'}</p>
            </div>
        </div>
        
        <div style="margin-bottom: 30px;">
            <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
            <p><strong>Invoice Date:</strong> ${new Date(invoice.issue_date).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span style="color: ${invoice.status === 'paid' ? '#28a745' : '#dc3545'}">${invoice.status.toUpperCase()}</span></p>
        </div>
        
        <h3>Order Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Product</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Quantity</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Unit Price (KES)</th>
                    <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Total (KES)</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items?.map(item => `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 10px;">${item.product_name}</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${item.quantity}</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${parseFloat(item.unit_price).toLocaleString()}</td>
                        <td style="border: 1px solid #ddd; padding: 10px;">${parseFloat(item.total_price).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;"><strong>Total:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 10px;"><strong>KES ${parseFloat(invoice.total_amount).toLocaleString()}</strong></td>
                </tr>
            </tfoot>
        </table>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888;">
            <p>Thank you for your business!</p>
            <p>Payment Terms: Net 30 days from invoice date</p>
        </div>
    `;

        document.body.appendChild(printContent);

        try {
            // Capture the content as canvas
            const canvas = await html2canvas(printContent, {
                scale: 2,
                logging: false,
                useCORS: true
            });

            // Create PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Invoice_${invoice.invoice_number}.pdf`);

        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            document.body.removeChild(printContent);
        }
    };


    const getStatusBadge = (status) => {
        switch (status) {
            case 'paid': return 'invoice-status-paid';
            case 'overdue': return 'invoice-status-overdue';
            case 'sent': return 'invoice-status-sent';
            default: return 'invoice-status-draft';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const filteredInvoices = invoices.filter(inv => {
        if (filter === 'all') return true;
        return inv.status === filter;
    });

    if (loading) {
        return <div className="retailer-placeholder">Loading invoices...</div>;
    }

    return (
        <div className="retailer-invoices">
            {selectedInvoice ? (
                // Invoice Details View
                <>
                    <button className="retailer-back-btn" onClick={() => setSelectedInvoice(null)}>
                        ← Back to Invoices
                    </button>

                    <div className="invoice-detail-card">
                        <div className="invoice-detail-header">
                            <h2>Invoice #{selectedInvoice.invoice_number}</h2>
                            <div className="invoice-actions">
                                <button
                                    className="invoice-download-btn"
                                    onClick={() => downloadInvoice(selectedInvoice)}
                                >
                                    <icons.LuDownload size={20} />
                                    Download PDF
                                </button>
                                {selectedInvoice.status !== 'paid' && (
                                    <button
                                        className="invoice-pay-btn"
                                        onClick={() => markAsPaid(selectedInvoice.invoice_id)}
                                    >
                                        Mark as Paid
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="invoice-info-grid">
                            <div className="invoice-info-card">
                                <h4>From</h4>
                                <p><strong>{selectedInvoice.wholesaler_name}</strong></p>
                                <p>Email: {selectedInvoice.wholesaler_email || 'N/A'}</p>
                                <p>Phone: {selectedInvoice.wholesaler_phone || 'N/A'}</p>
                            </div>
                            <div className="invoice-info-card">
                                <h4>Bill To</h4>
                                <p><strong>{selectedInvoice.retailer_name}</strong></p>
                                <p>Email: {selectedInvoice.retailer_email || 'N/A'}</p>
                                <p>Phone: {selectedInvoice.retailer_phone || 'N/A'}</p>
                                <p>Address: {selectedInvoice.retailer_address || 'N/A'}</p>
                            </div>
                            <div className="invoice-info-card">
                                <h4>Invoice Details</h4>
                                <p><strong>Invoice Date:</strong> {formatDate(selectedInvoice.issue_date)}</p>
                                <p><strong>Due Date:</strong> {formatDate(selectedInvoice.due_date)}</p>
                                <p><strong>Status:</strong>
                                    <span className={`invoice-status-badge ${getStatusBadge(selectedInvoice.status)}`}>
                                        {selectedInvoice.status?.toUpperCase()}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="invoice-items">
                            <h3>Order Items</h3>
                            <table className="invoice-items-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Unit Price (KES)</th>
                                        <th>Total (KES)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInvoice.items?.map(item => (
                                        <tr key={item.invoice_item_id}>
                                            <td>{item.product_name}</td>
                                            <td>{item.quantity}</td>
                                            <td>{parseFloat(item.unit_price).toLocaleString()}</td>
                                            <td>{parseFloat(item.total_price).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="invoice-total-row">
                                        <td colSpan="3" style={{ textAlign: 'right' }}><strong>Total:</strong></td>
                                        <td><strong>KES {parseFloat(selectedInvoice.total_amount).toLocaleString()}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="invoice-notes">
                            <p><strong>Payment Terms:</strong> Net 30 days from invoice date</p>
                            <p><strong>Payment Instructions:</strong> Please make payment via M-Pesa or Bank Transfer to the wholesaler's account.</p>
                        </div>
                    </div>
                </>
            ) : invoices.length === 0 ? (
                <div className="retailer-placeholder">
                    <icons.LuFileText size={48} style={{ opacity: 0.5 }} />
                    <h3>No Invoices Yet</h3>
                    <p>When you make credit purchases, invoices will appear here.</p>
                </div>
            ) : (
                <>
                    {/* Filter Tabs */}
                    <div className="invoice-filters">
                        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                            All ({invoices.length})
                        </button>
                        <button className={`filter-btn ${filter === 'sent' ? 'active' : ''}`} onClick={() => setFilter('sent')}>
                            Unpaid ({invoices.filter(i => i.status === 'sent').length})
                        </button>
                        <button className={`filter-btn ${filter === 'paid' ? 'active' : ''}`} onClick={() => setFilter('paid')}>
                            Paid ({invoices.filter(i => i.status === 'paid').length})
                        </button>
                        <button className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>
                            Overdue ({invoices.filter(i => i.status === 'overdue').length})
                        </button>
                    </div>

                    {/* Invoices List */}
                    <div className="invoices-list">
                        {filteredInvoices.map(invoice => (
                            <div
                                key={invoice.invoice_id}
                                className="invoice-card"
                                onClick={() => fetchInvoiceDetails(invoice.invoice_id)}
                            >
                                <div className="invoice-card-header">
                                    <div className="invoice-number">
                                        #{invoice.invoice_number}
                                    </div>
                                    <div className="invoice-amount">
                                        KES {parseFloat(invoice.total_amount).toLocaleString()}
                                    </div>
                                </div>
                                <div className="invoice-card-body">
                                    <div className="invoice-wholesaler">
                                        <icons.LuFactory size={20} />
                                        <span>{invoice.wholesaler_name}</span>
                                    </div>
                                    <div className="invoice-dates">
                                        <div className="invoice-date">
                                            <icons.LuCalendar size={20} />
                                            <span>Issued: {formatDate(invoice.issue_date)}</span>
                                        </div>
                                        <div className="invoice-date due">
                                            <icons.LuClock size={14} />
                                            <span>Due: {formatDate(invoice.due_date)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="invoice-card-footer">
                                    <span className={`invoice-status-badge ${getStatusBadge(invoice.status)}`}>
                                        {invoice.status?.toUpperCase()}
                                    </span>
                                    <button className="invoice-view-btn">View Details →</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default RetailerDashboard;