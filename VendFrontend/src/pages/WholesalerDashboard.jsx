import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import * as icons from 'react-icons/lu';
import '../styling/WholesalerDashboard.css';
import ProfileSettings from '../components/ProfileSettings';
import API from '../api/axiosConfig';
import ChatModule from '../components/ChatModule';

function WholesalerDashboard() {
    const { user, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeMenu, setActiveMenu] = useState('overview');

    // Redirect if not wholesaler
    if (!user || user.userType !== 'wholesaler') {
        window.location.href = '/login';
        return null;
    }

    // Wholesaler Menu Items
    const menuItems = [
        { id: 'overview', label: 'Dashboard Overview', icon: icons.LuHouse },
        { id: 'products', label: 'My Products', icon: icons.LuPackage },
        { id: 'orders', label: 'Orders', icon: icons.LuTruck },
        { id: 'inventory', label: 'Inventory', icon: icons.LuWarehouse },
        { id: 'reviews', label: 'Reviews', icon: icons.LuStar },
        { id: 'payouts', label: 'Payouts', icon: icons.LuDollarSign },
        { id: 'settings', label: 'Settings', icon: icons.LuSettings },
        { id: 'profile', label: 'My Profile', icon: icons.LuUser },
        { id: 'chat', label: 'Chat', icon: icons.LuMessageCircle },
    ];

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const renderContent = () => {
        switch (activeMenu) {
            case 'overview':
                return <OverviewSection user={user} />;
            case 'products':
                return <ProductsSection />;
            case 'orders':
                return <OrdersSection />;
            case 'inventory':
                return <InventorySection />;
            case 'reviews':
                return <ReviewsSection />;
            case 'payouts':
                return <PayoutsSection />;
            case 'settings':
                return <SettingsSection user={user} />;
            case 'profile':
                return <ProfileSection user={user} />;
            case 'chat':
                return <ChatModule />;
            default:
                return <OverviewSection user={user} />;
        }
    };




    return (
        <div className="wholesaler-dashboard">
            <Sidebar
                isOpen={sidebarOpen}
                onToggle={toggleSidebar}
                activeMenu={activeMenu}
                onMenuClick={setActiveMenu}
                user={user}
                onLogout={logout}
                menuItems={menuItems}
            />

            <div className={`wholesaler-main ${sidebarOpen ? 'wholesaler-main-expanded' : 'wholesaler-main-collapsed'}`}>
                <div className="wholesaler-topbar">
                    <h1 className="wholesaler-page-title">
                        {menuItems.find(item => item.id === activeMenu)?.label || 'Dashboard'}
                    </h1>
                </div>
                <div className="wholesaler-content">
                    {renderContent()}
                </div>
            </div>



        </div>
    );
}

// ============================================
// OVERVIEW SECTION
// ============================================

function OverviewSection({ user }) {
    const stats = [
        { label: 'Total Products', value: '0', icon: icons.LuPackage },
        { label: 'Total Orders', value: '0', icon: icons.LuTruck },
        { label: 'Pending Orders', value: '0', icon: icons.LuClock },
        { label: 'Total Revenue', value: 'KES 0', icon: icons.LuDollarSign },
    ];

    return (
        <div className="wholesaler-overview">
            <div className="wholesaler-welcome">
                <h2>Welcome back, {user?.name || user?.business_name}!</h2>
                <p>Manage your products, track orders, and grow your business.</p>
            </div>

            <div className="wholesaler-stats-grid">
                {stats.map((stat, idx) => (
                    <div key={idx} className="wholesaler-stat-card">
                        <div className="wholesaler-stat-icon"  >
                            <stat.icon size={50} />
                        </div>
                        <div className="wholesaler-stat-info">
                            <h3 className="wholesaler-stat-value">{stat.value}</h3>
                            <p className="wholesaler-stat-label">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="wholesaler-recent-orders">
                <h3 className="wholesaler-section-title">Recent Orders</h3>
                <div className="wholesaler-table-responsive">
                    <table className="wholesaler-table">
                        <thead>
                            <tr><th>Order ID</th><th>Retailer</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            <tr><td colSpan="5" style={{ textAlign: 'center' }}>No orders yet</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}


// ============================================
// PRODUCTS SECTION (with Debug Logs)
// ============================================

function ProductsSection() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [categories, setCategories] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        description: '',
        base_price: '',
        stock_quantity: '',
        min_order_quantity: '1',
        category_id: '',
        status: 'active',
        product_image: null,
        shipping_cost: '',
        shipping_per_unit: false,
        free_shipping_threshold: '',
        shipping_notes: ''
    });
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const fetchProducts = async () => {
        try {
            console.log(' Fetching products...');
            const response = await API.get('/products/my-products');
            console.log(' Products fetched:', response.data);
            // Log image URLs specifically
            response.data.forEach(product => {
                console.log(` Product: ${product.name}, Image URL:`, product.imageUrl);
            });
            setProducts(response.data);
        } catch (error) {
            console.error(' Fetch products error:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            console.log(' Fetching categories...');
            const response = await API.get('/products/categories-list');
            console.log(' Categories fetched:', response.data);
            setCategories(response.data);
        } catch (error) {
            console.error(' Fetch categories error:', error.response?.data);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        console.log(` Form field ${e.target.name} changed to:`, e.target.value);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log(' Image selected:', file.name, file.size, file.type);
            setFormData({ ...formData, product_image: file });
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const resetForm = () => {
        console.log(' Resetting form...');
        setFormData({
            name: '',
            sku: '',
            description: '',
            base_price: '',
            stock_quantity: '',
            min_order_quantity: '1',
            category_id: '',
            status: 'active',
            product_image: null
        });
        setImagePreview(null);
        setEditingProduct(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(' Submitting form...');
        console.log(' Form data:', formData);

        setUploading(true);

        const data = new FormData();
        data.append('name', formData.name);
        data.append('sku', formData.sku || '');
        data.append('description', formData.description || '');
        data.append('base_price', formData.base_price);
        data.append('stock_quantity', formData.stock_quantity);
        data.append('min_order_quantity', formData.min_order_quantity);
        data.append('category_id', formData.category_id);
        data.append('status', formData.status);

        if (formData.product_image) {
            data.append('product_image', formData.product_image);
            console.log('Image appended to FormData');
        }

        // Log FormData contents for debugging
        for (let pair of data.entries()) {
            console.log(`FormData entry: ${pair[0]} =`, pair[1]);
        }

        try {
            let response;
            if (editingProduct) {
                console.log(` Updating product ${editingProduct.product_id}...`);
                response = await API.put(`/products/${editingProduct.product_id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                console.log(' Update response:', response.data);
                alert('Product updated successfully!');
            } else {
                console.log(' Creating new product...');
                response = await API.post('/products', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                console.log(' Create response:', response.data);
                alert('Product created successfully!');
            }

            setShowModal(false);
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error(' Save product error:', error.response?.status, error.response?.data);
            alert(error.response?.data?.message || 'Failed to save product');
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (product) => {
        console.log(' Editing product:', product);
        setEditingProduct(product);
        setFormData({
            name: product.name,
            sku: product.sku || '',
            description: product.description || '',
            base_price: product.base_price,
            stock_quantity: product.stock_quantity,
            min_order_quantity: product.min_order_quantity || '1',
            category_id: product.category_id || '',
            status: product.status || 'active',
            product_image: null
        });
        setImagePreview(product.main_image_url);
        setShowModal(true);
    };

    const handleDelete = async (product) => {
        if (window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
            console.log(' Deleting product:', product.product_id);
            try {
                await API.delete(`/products/${product.product_id}`);
                console.log(' Delete successful');
                alert('Product deleted successfully!');
                fetchProducts();
            } catch (error) {
                console.error(' Delete error:', error.response?.data);
                alert('Failed to delete product');
            }
        }
    };

    if (loading) {
        return <div className="wholesaler-placeholder">Loading products...</div>;
    }

    return (
        <div className="wholesaler-products">
            <div className="wholesaler-section-header">
                <h2>My Products</h2>
                <button className="wholesaler-btn-primary" onClick={() => {
                    console.log(' Opening Add Product modal');
                    resetForm();
                    setShowModal(true);
                }}>
                    + Add New Product
                </button>
            </div>

            <div className="wholesaler-table-responsive">
                {products.length === 0 ? (
                    <div className="wholesaler-placeholder">
                        <icons.LuPackage size={48} />
                        <h3>No Products Yet</h3>
                        <p>Click "Add New Product" to start listing your products.</p>
                    </div>
                ) : (
                    <table className="wholesaler-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>SKU</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(product => (
                                <tr key={product.product_id}>
                                    <td className="wholesaler-product-image-cell">
                                        {product.imageUrl ? (
                                            <img
                                                src={product.imageUrl.startsWith('http') ? product.imageUrl : `http://localhost:5000${product.imageUrl}`}
                                                alt={product.name}
                                                className="wholesaler-product-thumb"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = '';
                                                    e.target.parentElement.innerHTML = '<div class="wholesaler-product-thumb-placeholder"><svg ...></svg></div>';
                                                }}
                                            />
                                        ) : (
                                            <div className="wholesaler-product-thumb-placeholder">
                                                <icons.LuPackage size={24} />
                                            </div>
                                        )}
                                    </td>
                                    <td>{product.name}</td>
                                    <td>{product.sku || 'N/A'}</td>
                                    <td>KES {product.base_price?.toLocaleString()}</td>
                                    <td>{product.stock_quantity}</td>
                                    <td>{product.category_name || 'Uncategorized'}</td>
                                    <td>
                                        <span className={`wholesaler-status ${product.status === 'active' ? 'wholesaler-status-active' : 'wholesaler-status-inactive'}`}>
                                            {product.status || 'active'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="wholesaler-btn-edit" onClick={() => handleEdit(product)}>
                                            Edit
                                        </button>
                                        <button className="wholesaler-btn-delete" onClick={() => handleDelete(product)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Product Modal */}
            {showModal && (
                <div className="wholesaler-modal-overlay" onClick={() => {
                    console.log(' Closing modal overlay');
                    setShowModal(false);
                }}>
                    <div className="wholesaler-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="wholesaler-modal-header">
                            <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                            <button className="wholesaler-modal-close" onClick={() => {
                                console.log(' Closing modal');
                                setShowModal(false);
                            }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="wholesaler-product-form">
                            <div className="wholesaler-form-group">
                                <label>Product Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="wholesaler-form-row">
                                <div className="wholesaler-form-group">
                                    <label>SKU (Optional)</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={formData.sku}
                                        onChange={handleInputChange}
                                        placeholder="Auto-generated if left empty"
                                    />
                                </div>
                                <div className="wholesaler-form-group">
                                    <label>Category *</label>
                                    <select
                                        name="category_id"
                                        value={formData.category_id}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">Select a category</option>
                                        {categories.map(cat => (
                                            <option key={cat.category_id} value={cat.category_id}>
                                                {cat.category_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="wholesaler-form-group">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows="4"
                                    placeholder="Describe your product..."
                                />
                            </div>

                            <div className="wholesaler-form-row">
                                <div className="wholesaler-form-group">
                                    <label>Price (KES) *</label>
                                    <input
                                        type="number"
                                        name="base_price"
                                        value={formData.base_price}
                                        onChange={handleInputChange}
                                        step="0.01"
                                        required
                                    />
                                </div>
                                <div className="wholesaler-form-group">
                                    <label>Stock Quantity *</label>
                                    <input
                                        type="number"
                                        name="stock_quantity"
                                        value={formData.stock_quantity}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="wholesaler-form-group">
                                    <label>Min Order Quantity</label>
                                    <input
                                        type="number"
                                        name="min_order_quantity"
                                        value={formData.min_order_quantity}
                                        onChange={handleInputChange}
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="wholesaler-form-row">
                                <div className="wholesaler-form-group">
                                    <label>Status</label>
                                    <select name="status" value={formData.status} onChange={handleInputChange}>
                                        <option value="active">Active (Visible to retailers)</option>
                                        <option value="inactive">Inactive (Hidden from retailers)</option>
                                        <option value="draft">Draft (Not published)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="wholesaler-form-row">
                                <div className="wholesaler-form-group">
                                    <label>Shipping Configuration</label>
                                    <div className="shipping-config">
                                        <div className="shipping-row">
                                            <input
                                                type="number"
                                                name="shipping_cost"
                                                value={formData.shipping_cost}
                                                onChange={handleInputChange}
                                                step="0.01"
                                                placeholder="Shipping cost (KES)"
                                                style={{ width: '48%', marginRight: '4%' }}
                                            />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '48%' }}>
                                                <input
                                                    type="checkbox"
                                                    name="shipping_per_unit"
                                                    checked={formData.shipping_per_unit}
                                                    onChange={(e) => setFormData({ ...formData, shipping_per_unit: e.target.checked })}
                                                />
                                                Cost per unit?
                                            </label>
                                        </div>

                                        <div className="shipping-row" style={{ marginTop: '10px' }}>
                                            <input
                                                type="number"
                                                name="free_shipping_threshold"
                                                value={formData.free_shipping_threshold}
                                                onChange={handleInputChange}
                                                step="0.01"
                                                placeholder="Free shipping above (KES) - optional"
                                                style={{ width: '100%' }}
                                            />
                                        </div>

                                        <div className="shipping-row" style={{ marginTop: '10px' }}>
                                            <textarea
                                                name="shipping_notes"
                                                value={formData.shipping_notes}
                                                onChange={handleInputChange}
                                                placeholder="Shipping notes (e.g., 'Ships within 3 business days')"
                                                rows="2"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <div className="wholesaler-form-group">
                                <label>Product Image</label>
                                <div className="wholesaler-image-upload">
                                    {imagePreview ? (
                                        <div className="wholesaler-image-preview">
                                            <img src={imagePreview} alt="Preview" />
                                            <button type="button" onClick={() => {
                                                console.log(' Removing image preview');
                                                setImagePreview(null);
                                                setFormData({ ...formData, product_image: null });
                                            }}>Remove</button>
                                        </div>
                                    ) : (
                                        <div className="wholesaler-image-dropzone">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                id="product-image"
                                            />
                                            <label htmlFor="product-image">
                                                <icons.LuUpload size={24} />
                                                <span>Click to upload image</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="wholesaler-modal-buttons">
                                <button type="button" className="wholesaler-btn-secondary" onClick={() => {
                                    console.log(' Cancel button clicked');
                                    setShowModal(false);
                                }}>
                                    Cancel
                                </button>
                                <button type="submit" className="wholesaler-btn-primary" disabled={uploading}>
                                    {uploading ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}



// ============================================
// ORDERS SECTION (for wholesaler order management)
// ============================================
function OrdersSection() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [processingCredit, setProcessingCredit] = useState(false);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await API.get('/orders/wholesaler/orders');
            setOrders(response.data);
        } catch (error) {
            console.error('Fetch orders error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderDetails = async (orderId) => {
        try {
            const response = await API.get(`/orders/wholesaler/orders/${orderId}`);
            console.log('Order details response:', response.data);
            setSelectedOrder(response.data);
        } catch (error) {
            console.error('Fetch order details error:', error);
            alert('Failed to load order details');
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        setUpdatingStatus(true);
        try {
            await API.put(`/orders/wholesaler/orders/${orderId}/status`, {
                status: newStatus
            });

            await fetchOrders();

            if (selectedOrder && selectedOrder.order_id === orderId) {
                const updatedOrder = await API.get(`/orders/wholesaler/orders/${orderId}`);
                setSelectedOrder(updatedOrder.data);
            }

            alert(`Order status updated to ${newStatus}`);
        } catch (error) {
            console.error('Update status error:', error);
            alert('Failed to update order status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    //  Approve Credit Request
    const approveCredit = async (orderId) => {
        setProcessingCredit(true);
        try {
            await API.put(`/credit/orders/${orderId}/approve`, {
                status: 'approved'
            });

            alert(' Credit request approved! The order is now confirmed.');
            await fetchOrders();

            if (selectedOrder && selectedOrder.order_id === orderId) {
                const updatedOrder = await API.get(`/orders/wholesaler/orders/${orderId}`);
                setSelectedOrder(updatedOrder.data);
            }
        } catch (error) {
            console.error('Approve credit error:', error);
            alert('Failed to approve credit request');
        } finally {
            setProcessingCredit(false);
        }
    };

    // Deny Credit Request
    const denyCredit = async (orderId) => {
        setProcessingCredit(true);
        try {
            await API.put(`/credit/orders/${orderId}/deny`, {
                status: 'rejected'
            });

            alert('❌ Credit request denied. The order has been cancelled.');
            await fetchOrders();
            setSelectedOrder(null);
        } catch (error) {
            console.error('Deny credit error:', error);
            alert('Failed to deny credit request');
        } finally {
            setProcessingCredit(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'delivered': return 'wholesaler-status-delivered';
            case 'shipped': return 'wholesaler-status-shipped';
            case 'confirmed': return 'wholesaler-status-confirmed';
            case 'processing': return 'wholesaler-status-processing';
            case 'pending': return 'wholesaler-status-pending';
            case 'cancelled': return 'wholesaler-status-cancelled';
            default: return 'wholesaler-status-pending';
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

    const filteredOrders = orders.filter(order => {
        if (filter === 'all') return true;
        return order.status === filter;
    });

    if (loading) {
        return <div className="wholesaler-placeholder">Loading orders...</div>;
    }

    return (
        <div className="wholesaler-orders">
            {selectedOrder ? (
                // Order Details View
                <>
                    <button className="wholesaler-back-btn" onClick={() => setSelectedOrder(null)}>
                        ← Back to Orders
                    </button>

                    <div className="wholesaler-order-detail">
                        <div className="wholesaler-order-detail-header">
                            <h2>Order #{selectedOrder.order_number}</h2>
                            <span className={getStatusBadgeClass(selectedOrder.status)}>
                                {selectedOrder.status?.toUpperCase()}
                            </span>
                        </div>

                        <div className="wholesaler-order-info-grid">
                            <div className="wholesaler-order-info-card">
                                <h4>Customer Information</h4>
                                <p><strong>Name:</strong> {selectedOrder.retailer_name}</p>
                                <p><strong>Email:</strong> {selectedOrder.retailer_email}</p>
                                <p><strong>Phone:</strong> {selectedOrder.retailer_phone}</p>
                                <p><strong>Address:</strong> {selectedOrder.retailer_address}</p>
                            </div>

                            <div className="wholesaler-order-info-card">
                                <h4>Payment Information</h4>
                                <p><strong>Payment Method:</strong>
                                    {selectedOrder.payment_method === 'credit' ? (
                                        <span className="credit-method-badge">
                                            <icons.LuFileText size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            Credit (Buy Now, Pay Later)
                                        </span>
                                    ) : (
                                        <span>
                                            <icons.LuSmartphone size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            {selectedOrder.payment_method?.toUpperCase() || 'Not specified'}
                                        </span>
                                    )}
                                </p>
                                <p><strong>Payment Status:</strong>
                                    <span className={selectedOrder.payment_status === 'paid' ? 'payment-paid' : 'payment-pending'}>
                                        {selectedOrder.payment_status === 'paid' ? (
                                            <><icons.LuCheck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Paid</>
                                        ) : selectedOrder.payment_status === 'credit_pending' ? (
                                            <><icons.LuClock size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Credit - Awaiting Approval</>
                                        ) : (
                                            <><icons.LuX size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Unpaid</>
                                        )}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="wholesaler-order-items">
                            <h3>Order Items</h3>
                            <table className="wholesaler-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Unit Price</th>
                                        <th>Total</th>
                                    </tr>
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

                        {/* Credit Request Approval Section */}
                        {selectedOrder.payment_method === 'credit' && selectedOrder.payment_status === 'credit_pending' && (
                            <div className="wholesaler-credit-approval-section">
                                <h4>Credit Request</h4>
                                <p className="credit-request-message">
                                    This retailer has requested to pay for this order on credit.
                                    Please review the request and approve or deny.
                                </p>
                                <div className="wholesaler-credit-actions">
                                    <button
                                        className="credit-approve-btn"
                                        onClick={() => approveCredit(selectedOrder.order_id)}
                                        disabled={processingCredit}
                                    >
                                        <icons.LuCheck size={16} style={{ marginRight: '6px' }} />
                                        Approve Credit Request
                                    </button>
                                    <button
                                        className="credit-deny-btn"
                                        onClick={() => denyCredit(selectedOrder.order_id)}
                                        disabled={processingCredit}
                                    >
                                        <icons.LuX size={16} style={{ marginRight: '6px' }} />
                                        Deny Credit Request
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status Update Buttons (for non-credit or approved credit orders) */}
                        {(selectedOrder.payment_method !== 'credit' || selectedOrder.payment_status !== 'credit_pending') && (
                            <div className="wholesaler-order-actions">
                                <h4>Update Order Status</h4>
                                <div className="wholesaler-action-buttons">
                                    {selectedOrder.status !== 'confirmed' && selectedOrder.status !== 'shipped' && selectedOrder.status !== 'delivered' && (
                                        <button
                                            className="wholesaler-action-btn confirm"
                                            onClick={() => updateOrderStatus(selectedOrder.order_id, 'confirmed')}
                                            disabled={updatingStatus}
                                        >
                                            <icons.LuCheck size={18} style={{ marginRight: '6px' }} />
                                            Confirm Order
                                        </button>
                                    )}

                                    {selectedOrder.status !== 'shipped' && selectedOrder.status !== 'delivered' && (
                                        <button
                                            className="wholesaler-action-btn ship"
                                            onClick={() => updateOrderStatus(selectedOrder.order_id, 'shipped')}
                                            disabled={updatingStatus}
                                        >
                                            <icons.LuTruck size={18} style={{ marginRight: '6px' }} />
                                            Mark as Shipped
                                        </button>
                                    )}

                                    {selectedOrder.status !== 'delivered' && (
                                        <button
                                            className="wholesaler-action-btn deliver"
                                            onClick={() => updateOrderStatus(selectedOrder.order_id, 'delivered')}
                                            disabled={updatingStatus}
                                        >
                                            <icons.LuPackageCheck size={18} style={{ marginRight: '6px' }} />
                                            Mark as Delivered
                                        </button>
                                    )}

                                    {selectedOrder.status !== 'cancelled' && (
                                        <button
                                            className="wholesaler-action-btn cancel"
                                            onClick={() => updateOrderStatus(selectedOrder.order_id, 'cancelled')}
                                            disabled={updatingStatus}
                                        >
                                            <icons.LuX size={18} style={{ marginRight: '6px' }} />
                                            Cancel Order
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : orders.length === 0 ? (
                <div className="wholesaler-placeholder">
                    <icons.LuTruck size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
                    <h3>No Orders Yet</h3>
                    <p>When retailers place orders, they will appear here.</p>
                </div>
            ) : (
                <>
                    {/* Filter Tabs */}
                    <div className="wholesaler-orders-filter">
                        <button
                            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All ({orders.length})
                        </button>
                        <button
                            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                            onClick={() => setFilter('pending')}
                        >
                            Pending ({orders.filter(o => o.status === 'pending').length})
                        </button>
                        <button
                            className={`filter-btn ${filter === 'confirmed' ? 'active' : ''}`}
                            onClick={() => setFilter('confirmed')}
                        >
                            Confirmed ({orders.filter(o => o.status === 'confirmed').length})
                        </button>
                        <button
                            className={`filter-btn ${filter === 'shipped' ? 'active' : ''}`}
                            onClick={() => setFilter('shipped')}
                        >
                            Shipped ({orders.filter(o => o.status === 'shipped').length})
                        </button>
                        <button
                            className={`filter-btn ${filter === 'delivered' ? 'active' : ''}`}
                            onClick={() => setFilter('delivered')}
                        >
                            Delivered ({orders.filter(o => o.status === 'delivered').length})
                        </button>
                        <button
                            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
                            onClick={() => setFilter('cancelled')}
                        >
                            Cancelled ({orders.filter(o => o.status === 'cancelled').length})
                        </button>
                    </div>

                    {/* Orders List */}
                    <div className="wholesaler-orders-list">
                        {filteredOrders.map(order => (
                            <div
                                key={order.order_id}
                                className="wholesaler-order-card"
                                onClick={() => fetchOrderDetails(order.order_id)}
                            >
                                <div className="wholesaler-order-card-header">
                                    <div className="wholesaler-order-number">
                                        #{order.order_number}
                                        {order.payment_method === 'credit' && order.payment_status === 'credit_pending' && (
                                            <span className="wholesaler-credit-badge">
                                                <icons.LuHourglass size={17} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                Credit Request
                                            </span>
                                        )}
                                        {order.payment_method === 'credit' && order.payment_status === 'credit_approved' && (
                                            <span className="wholesaler-credit-approved-badge">
                                                ✓ Credit Approved
                                            </span>
                                        )}
                                        {order.payment_method === 'credit' && order.payment_status === 'paid' && (
                                            <span className="wholesaler-credit-paid-badge">
                                                💰 Credit Paid
                                            </span>
                                        )}
                                    </div>
                                    <span className={getStatusBadgeClass(order.status)}>{order.status}</span>
                                </div>
                                <div className="wholesaler-order-card-body">
                                    <div className="wholesaler-order-customer">
                                        <icons.LuStore size={22} style={{ marginRight: '8px' }} />
                                        <span>{order.retailer_name}</span>
                                    </div>
                                    <div className="wholesaler-order-amount">
                                        <icons.LuDollarSign size={22} style={{ marginRight: '8px' }} />
                                        <span>KES {order.total_amount?.toLocaleString()}</span>
                                    </div>
                                    <div className="wholesaler-order-date">
                                        <icons.LuCalendar size={22} style={{ marginRight: '8px' }} />
                                        <span>{formatDate(order.ordered_at)}</span>
                                    </div>
                                    <div className="wholesaler-order-items-count">
                                        <icons.LuPackage size={22} style={{ marginRight: '8px' }} />
                                        <span>{order.item_count} items</span>
                                    </div>
                                </div>
                                <div className="wholesaler-order-card-footer">
                                    <button
                                        className="wholesaler-view-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            fetchOrderDetails(order.order_id);
                                        }}
                                    >
                                        View Details →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ============================================
// INVENTORY SECTION
// ============================================

function InventorySection() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({
        total: 0,
        lowStock: 0,
        outOfStock: 0,
        active: 0,
        deleted: 0
    });

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await API.get('/products/my-products');
            const productsData = response.data;
            setProducts(productsData);
            calculateStats(productsData);
        } catch (err) {
            console.error('Fetch inventory error:', err);
            setError(err.response?.data?.message || 'Failed to fetch inventory');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (productsData) => {
        const statsData = {
            total: productsData.length,
            lowStock: 0,
            outOfStock: 0,
            active: 0,
            deleted: 0
        };

        productsData.forEach(product => {
            // Count by status
            if (product.deleted_at !== null) {
                statsData.deleted++;
            } else if (product.status === 'active') {
                statsData.active++;
            }

            // Count low stock and out of stock (only for active products)
            if (product.deleted_at === null) {
                const stock = parseInt(product.stock_quantity) || 0;
                const minOrderQty = parseInt(product.min_order_quantity) || 1;

                if (stock === 0) {
                    statsData.outOfStock++;
                } else if (stock < minOrderQty * 2) {
                    statsData.lowStock++;
                }
            }
        });

        setStats(statsData);
    };

    const getStockStatus = (product) => {
        // Check if product is deleted
        if (product.deleted_at !== null) {
            return { status: 'deleted', label: 'Deleted', className: 'inv-status-deleted' };
        }

        // Check if product is inactive
        if (product.status === 'inactive') {
            return { status: 'inactive', label: 'Inactive', className: 'inv-status-inactive' };
        }

        const stock = parseInt(product.stock_quantity) || 0;
        const minOrderQty = parseInt(product.min_order_quantity) || 1;

        // Check stock levels
        if (stock === 0) {
            return { status: 'out-of-stock', label: 'Out of Stock', className: 'inv-status-out-of-stock' };
        } else if (stock < minOrderQty * 2) {
            return { status: 'low-stock', label: 'Low Stock', className: 'inv-status-low-stock' };
        } else if (stock < minOrderQty * 5) {
            return { status: 'medium-stock', label: 'Medium Stock', className: 'inv-status-medium-stock' };
        }

        return { status: 'in-stock', label: 'In Stock', className: 'inv-status-in-stock' };
    };

    const formatCurrency = (amount) => {
        return `KES ${parseFloat(amount || 0).toLocaleString()}`;
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

    const handleExportStockReport = () => {
        // Generate CSV report
        const headers = ['Product Name', 'SKU', 'Stock Quantity', 'Status', 'Category', 'Price'];
        const rows = products.map(product => [
            product.name,
            product.sku || 'N/A',
            product.stock_quantity || 0,
            getStockStatus(product).label,
            product.category_name || 'N/A',
            formatCurrency(product.base_price)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleUpdateStock = async (productId, currentStock) => {
        const newStock = prompt('Enter new stock quantity:', currentStock);
        if (newStock === null) return;

        const stockNumber = parseInt(newStock);
        if (isNaN(stockNumber) || stockNumber < 0) {
            alert('Please enter a valid number');
            return;
        }

        try {
            await API.put(`/products/${productId}`, { stock_quantity: stockNumber });
            await fetchInventory();
        } catch (err) {
            console.error('Update stock error:', err);
            alert('Failed to update stock');
        }
    };

    if (loading) {
        return (
            <div className="inv-loading">
                <div className="inv-loading-spinner"></div>
                <p>Loading inventory...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="inv-error">
                <p>{error}</p>
                <button onClick={fetchInventory} className="inv-retry-btn">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="inventory-module">
            {/* Stats Cards */}
            <div className="inv-stats-grid">
                <div className="inv-stat-card">
                    <div className="inv-stat-info">
                        <h4 className="inv-stat-value">{stats.total}</h4>
                        <p className="inv-stat-label">Total Products</p>
                    </div>
                </div>
                <div className="inv-stat-card active">
                    <div className="inv-stat-info">
                        <h4 className="inv-stat-value">{stats.active}</h4>
                        <p className="inv-stat-label">Active</p>
                    </div>
                </div>
                <div className="inv-stat-card low">
                    <div className="inv-stat-info">
                        <h4 className="inv-stat-value">{stats.lowStock}</h4>
                        <p className="inv-stat-label">Low Stock</p>
                    </div>
                </div>
                <div className="inv-stat-card out">
                    <div className="inv-stat-info">
                        <h4 className="inv-stat-value">{stats.outOfStock}</h4>
                        <p className="inv-stat-label">Out of Stock</p>
                    </div>
                </div>
                <div className="inv-stat-card deleted">
                    <div className="inv-stat-info">
                        <h4 className="inv-stat-value">{stats.deleted}</h4>
                        <p className="inv-stat-label">Deleted</p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="inv-header">
                <h2>Inventory Management</h2>
                <button
                    className="inv-export-btn"
                    onClick={handleExportStockReport}
                    disabled={products.length === 0}
                >
                    Export Stock Report
                </button>
            </div>

            {/* Inventory Table */}
            <div className="inv-table-wrap">
                {products.length === 0 ? (
                    <div className="inv-empty">
                        <p>No products in inventory</p>
                        <span className="inv-empty-sub">Add your first product to get started</span>
                    </div>
                ) : (
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(product => {
                                const stockStatus = getStockStatus(product);
                                const isDeleted = product.deleted_at !== null;

                                return (
                                    <tr key={product.product_id} className={isDeleted ? 'inv-row-deleted' : ''}>
                                        <td>
                                            <div className="inv-product-cell">
                                                {product.imageUrl && (
                                                    <img
                                                        src={product.imageUrl}
                                                        alt={product.name}
                                                        className="inv-product-thumb"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                                <span>{product.name}</span>
                                            </div>
                                        </td>
                                        <td>{product.sku || 'N/A'}</td>
                                        <td>{product.category_name || 'N/A'}</td>
                                        <td className="inv-stock-cell">
                                            <span className="inv-stock-number">{product.stock_quantity || 0}</span>
                                        </td>
                                        <td>{formatCurrency(product.base_price)}</td>
                                        <td>
                                            <span className={`inv-status ${stockStatus.className}`}>
                                                {stockStatus.label}
                                            </span>
                                            {isDeleted && (
                                                <span className="inv-deleted-date">
                                                    <br />
                                                    <small>Deleted: {formatDate(product.deleted_at)}</small>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="inv-actions">
                                                {!isDeleted && (
                                                    <>
                                                        <button
                                                            className="inv-btn-stock"
                                                            onClick={() => handleUpdateStock(product.product_id, product.stock_quantity)}
                                                        >
                                                            Update Stock
                                                        </button>
                                                        <button
                                                            className="inv-btn-edit"
                                                            onClick={() => window.location.href = `/wholesaler/products/edit/${product.product_id}`}
                                                        >
                                                            Edit
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ============================================
// REVIEWS SECTION
// ============================================

function ReviewsSection() {
    return (
        <div className="wholesaler-reviews">
            <div className="wholesaler-section-header">
                <h2>Customer Reviews</h2>
                <div className="wholesaler-rating-summary">
                    <span className="wholesaler-average-rating">0.0 ⭐</span>
                    <span className="wholesaler-total-reviews">(0 reviews)</span>
                </div>
            </div>
            <div className="wholesaler-table-responsive">
                <table className="wholesaler-table">
                    <thead>
                        <tr><th>Retailer</th><th>Rating</th><th>Review</th><th>Product</th><th>Date</th><th>Response</th></tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan="6" style={{ textAlign: 'center' }}>No reviews yet</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}



// ============================================
// PROFILE SECTION
// ============================================

function ProfileSection({ user }) {
    return (
        <div className="dash-profile">
            <ProfileSettings
                user={user}
                isModal={false}
                onUpdate={() => window.location.reload()}
            />
        </div>
    );
}



// ============================================
// PAYOUTS SECTION
// ============================================

function PayoutsSection() {
    return (
        <div className="wholesaler-payouts">
            <div className="wholesaler-stats-grid">
                <div className="wholesaler-stat-card">
                    <div className="wholesaler-stat-icon" >
                        <icons.LuDollarSign size={45} />
                    </div>
                    <div className="wholesaler-stat-info">
                        <h3 className="wholesaler-stat-value">KES 0</h3>
                        <p className="wholesaler-stat-label">Total Earnings</p>
                    </div>
                </div>
                <div className="wholesaler-stat-card">
                    <div className="wholesaler-stat-icon" >
                        <icons.LuClock size={45} />
                    </div>
                    <div className="wholesaler-stat-info">
                        <h3 className="wholesaler-stat-value">KES 0</h3>
                        <p className="wholesaler-stat-label">Pending Payouts</p>
                    </div>
                </div>
            </div>
            <div className="wholesaler-table-responsive">
                <table className="wholesaler-table">
                    <thead>
                        <tr><th>Date</th><th>Amount</th><th>Status</th><th>Payment Method</th><th>Reference</th></tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan="5" style={{ textAlign: 'center' }}>No payout history yet</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================
// SETTINGS SECTION
// ============================================

function SettingsSection({ user }) {
    return (
        <div className="wholesaler-settings">
            <h2 style={{ fontFamily: 'arial' }}>Business Settings</h2>
            <div className="wholesaler-settings-form">
                <div className="wholesaler-form-group">
                    <label style={{ fontFamily: 'arial' }}>Business Name</label>
                    <input type="text" value={user?.name || user?.business_name || ''} disabled />
                </div>
                <div className="wholesaler-form-group">
                    <label style={{ fontFamily: 'arial' }}>Email</label>
                    <input type="email" value={user?.email || ''} disabled />
                </div>
                <div className="wholesaler-form-group">
                    <label style={{ fontFamily: 'arial' }}>Phone Number</label>
                    <input type="tel" placeholder="Enter phone number" />
                </div>
                <div className="wholesaler-form-group">
                    <label style={{ fontFamily: 'arial' }}>Business Address</label>
                    <textarea placeholder="Enter business address" rows="3"></textarea>
                </div>
                <div className="wholesaler-form-group">
                    <label style={{ fontFamily: 'arial' }}>M-Pesa Phone Number (for payouts)</label>
                    <input type="tel" placeholder="e.g., 0712345678" />
                </div>
                <button className="wholesaler-btn-primary">Save Changes</button>
            </div>
        </div>
    );
}



export default WholesalerDashboard;