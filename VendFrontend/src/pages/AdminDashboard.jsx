import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import * as icons from 'react-icons/lu';
import '../styling/AdminDashboard.css';
import '../styling/Sidebar.css';
import API from '../api/axiosConfig';
import ProfileSettings from '../components/ProfileSettings';
import ChatModule from '../components/ChatModule';



function AdminDashboard() {
    const { user, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeMenu, setActiveMenu] = useState('overview');
    const [showChat, setShowChat] = useState(false);

    // Redirect if not admin
    if (!user || user.userType !== 'admin') {
        window.location.href = '/login';
        return null;
    }


    const isSuperAdmin = user.role === 'super_admin';

    // Menu items
    const menuItems = [
        { id: 'overview', label: 'Dashboard Overview', icon: icons.LuHouse, roles: ['super_admin', 'moderator'] },
        { id: 'users', label: 'Users Management', icon: icons.LuUsers, roles: ['super_admin', 'moderator'] },
        { id: 'verification', label: 'Verification Queue', icon: icons.LuRectangleEllipsis, roles: ['super_admin', 'moderator'] },
        { id: 'products', label: 'Product Moderation', icon: icons.LuPackage, roles: ['super_admin', 'moderator'] },
        { id: 'orders', label: 'Order Monitoring', icon: icons.LuTruck, roles: ['super_admin', 'moderator'] },
        { id: 'settings', label: 'Platform Settings', icon: icons.LuSettings, roles: ['super_admin'] },
        { id: 'reports', label: 'Reports & Analytics', icon: icons.LuActivity, roles: ['super_admin', 'moderator'] },
        { id: 'profile', label: 'My Profile', icon: icons.LuUser },
        { id: 'chat', label: 'Chat', icon: icons.LuMessageCircle },
    ];

    const visibleMenuItems = menuItems.filter(item => {
        // If user is admin (by userType), show all menus
        if (user.userType === 'admin') {
            return true;
        }
        // Otherwise filter by role
        return item.roles.includes(user.role);
    });

    const handleMenuClick = (menuId) => {
        setActiveMenu(menuId);
    };

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const renderContent = () => {
        switch (activeMenu) {
            case 'overview':
                return <OverviewSection />;
            case 'users':
                return <UsersSection />;
            case 'verification':
                return <VerificationSection />;
            case 'products':
                return <ProductsSection />;
            case 'orders':
                return <OrdersSection />;

            case 'settings':
                return <SettingsSection />;
            case 'reports':
                return <ReportsSection />;
            case 'profile':
                return <ProfileSection user={user} />;
            case 'chat':
                return <ChatModule />;
            default:
                return <OverviewSection />;
        }
    };




    return (
        <div className="dash-container">
            <Sidebar
                isOpen={sidebarOpen}
                onToggle={toggleSidebar}
                activeMenu={activeMenu}
                onMenuClick={handleMenuClick}
                user={user}
                onLogout={logout}
                menuItems={visibleMenuItems}
            />

            <div className={`dash-main ${sidebarOpen ? 'dash-main-expanded' : 'dash-main-collapsed'}`}>
                <div className="dash-topbar">
                    <h1 className="dash-page-title">
                        {visibleMenuItems.find(item => item.id === activeMenu)?.label || 'Dashboard'}
                    </h1>
                </div>
                <div className="dash-content">
                    {renderContent()}
                </div>
            </div>




        </div>
    );
}

// ==================== Section Components ====================

function OverviewSection() {
    const [stats, setStats] = useState([
        { label: 'Total Retailers', value: '0', change: '+0%', icon: icons.LuStore },
        { label: 'Total Wholesalers', value: '0', change: '+0%', icon: icons.LuBuilding2 },
        { label: 'Pending Verifications', value: '0', change: '0 new', icon: icons.LuClock },
        { label: 'Total Orders', value: '0', change: '+0%', icon: icons.LuShoppingCart },
        { label: 'Platform Revenue', value: 'KES 0', change: '+0%', icon: icons.LuDollarSign },
        { label: 'Active Disputes', value: '0', change: '0', icon: icons.LuGavel },
    ]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError('');

            // Fetch all data in parallel
            const [
                statsRes,
                ordersRes
            ] = await Promise.all([
                API.get('/admin/stats'),
                API.get('/admin/recent-orders')
            ]);

            // Update stats with real data
            const statsData = statsRes.data;
            setStats([
                {
                    label: 'Total Retailers',
                    value: statsData.retailers?.toLocaleString() || '0',
                    change: calculateChange(statsData.retailers, 0),
                    icon: icons.LuStore
                },
                {
                    label: 'Total Wholesalers',
                    value: statsData.wholesalers?.toLocaleString() || '0',
                    change: calculateChange(statsData.wholesalers, 0),
                    icon: icons.LuBuilding2
                },
                {
                    label: 'Pending Verifications',
                    value: statsData.pendingVerifications?.toLocaleString() || '0',
                    change: `${statsData.pendingVerifications || 0} pending`,
                    icon: icons.LuClock
                },
                {
                    label: 'Total Orders',
                    value: statsData.orders?.toLocaleString() || '0',
                    change: calculateChange(statsData.orders, 0),
                    icon: icons.LuShoppingCart
                },
                {
                    label: 'Platform Revenue',
                    value: `KES ${(statsData.revenue || 0).toLocaleString()}`,
                    change: calculateChange(statsData.revenue, 0),
                    icon: icons.LuDollarSign
                },
                {
                    label: 'Active Disputes',
                    value: statsData.activeDisputes?.toLocaleString() || '0',
                    change: `${statsData.activeDisputes || 0} open`,
                    icon: icons.LuGavel
                },
            ]);

            // Update recent orders
            if (ordersRes.data && Array.isArray(ordersRes.data)) {
                setRecentOrders(ordersRes.data);
            }

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Failed to load dashboard data. Please refresh the page.');

            // Try to fetch individually if the combined approach fails
            try {
                await fetchIndividualStats();
            } catch (fallbackErr) {
                console.error('Fallback fetch also failed:', fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fallback function to fetch individual stats
    const fetchIndividualStats = async () => {
        try {
            const statsRes = await API.get('/admin/stats');
            const ordersRes = await API.get('/admin/recent-orders');

            const statsData = statsRes.data;
            setStats([
                { label: 'Total Retailers', value: statsData.retailers?.toLocaleString() || '0', change: calculateChange(statsData.retailers, 0), icon: icons.LuStore },
                { label: 'Total Wholesalers', value: statsData.wholesalers?.toLocaleString() || '0', change: calculateChange(statsData.wholesalers, 0), icon: icons.LuBuilding2 },
                { label: 'Pending Verifications', value: statsData.pendingVerifications?.toLocaleString() || '0', change: `${statsData.pendingVerifications || 0} pending`, icon: icons.LuClock },
                { label: 'Total Orders', value: statsData.orders?.toLocaleString() || '0', change: calculateChange(statsData.orders, 0), icon: icons.LuShoppingCart },
                { label: 'Platform Revenue', value: `KES ${(statsData.revenue || 0).toLocaleString()}`, change: calculateChange(statsData.revenue, 0), icon: icons.LuDollarSign },
                { label: 'Active Disputes', value: statsData.activeDisputes?.toLocaleString() || '0', change: `${statsData.activeDisputes || 0} open`, icon: icons.LuGavel },
            ]);

            if (ordersRes.data && Array.isArray(ordersRes.data)) {
                setRecentOrders(ordersRes.data);
            }
        } catch (err) {
            console.error('Fallback fetch error:', err);
            setError('Unable to load dashboard data. Please refresh the page.');
        }
    };

    // Helper function to calculate percentage change
    const calculateChange = (current, previous) => {
        if (!previous || previous === 0) {
            return '+0%';
        }
        const change = ((current - previous) / previous) * 100;
        return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const getStatusBadgeClass = (status) => {
        const statusMap = {
            'delivered': 'dash-status-delivered',
            'shipped': 'dash-status-shipped',
            'processing': 'dash-status-processing',
            'pending': 'dash-status-pending',
            'cancelled': 'dash-status-cancelled',
            'refunded': 'dash-status-refunded'
        };
        return statusMap[status?.toLowerCase()] || 'dash-status-pending';
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

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-loading-spinner"></div>
                <p>Loading dashboard data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dash-error">
                <icons.LuAlertCircle size={40} />
                <p>{error}</p>
                <button onClick={fetchDashboardData} className="dash-retry-btn">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="dash-overview">
            {/* Stats Grid */}
            <div className="dash-stats-grid">
                {stats.map((stat, idx) => {
                    const IconComponent = stat.icon;
                    return (
                        <div key={idx} className="dash-stat-card">
                            <div className="dash-stat-icon">
                                <IconComponent size={45} />
                            </div>
                            <div className="dash-stat-info">
                                <h3 className="dash-stat-value">{stat.value}</h3>
                                <p className="dash-stat-label">{stat.label}</p>
                                <span className={`dash-stat-change ${stat.change.startsWith('+') ? 'positive' : stat.change.startsWith('-') ? 'negative' : 'neutral'}`}>
                                    {stat.change}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Orders */}
            <div className="dash-recent-orders">
                <div className="dash-section-header">
                    <h3 className="dash-section-title">Recent Orders</h3>
                    <a href="/admin/orders" className="dash-view-all">View All →</a>
                </div>
                <div className="dash-table-responsive">
                    {recentOrders.length === 0 ? (
                        <div className="dash-empty-state">
                            <icons.LuInbox size={40} />
                            <p>No recent orders found</p>
                        </div>
                    ) : (
                        <table className="dash-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Retailer</th>
                                    <th>Wholesaler</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map(order => (
                                    <tr key={order.order_id || order.id}>
                                        <td className="dash-order-id">{order.order_id || order.order_number || 'N/A'}</td>
                                        <td>{order.retailer || order.retailer_name || 'N/A'}</td>
                                        <td>{order.wholesaler || order.wholesaler_name || 'N/A'}</td>
                                        <td className="dash-amount">KES {parseFloat(order.total_amount || 0).toLocaleString()}</td>
                                        <td>{formatDate(order.created_at || order.date)}</td>
                                        <td>
                                            <span className={`dash-status ${getStatusBadgeClass(order.status)}`}>
                                                {order.status || 'pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}



//USERS SECTION WITH API INTEGRATION
function UsersSection() {
    const [userType, setUserType] = useState('retailers');
    const [users, setUsers] = useState([]);
    const [retailerCount, setRetailerCount] = useState(0);
    const [wholesalerCount, setWholesalerCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch counts once when component mounts
    useEffect(() => {
        fetchCounts();
    }, []);

    // Fetch users when userType changes
    useEffect(() => {
        fetchUsers();
    }, [userType]);

    const fetchCounts = async () => {
        try {
            // Get ALL retailers (including unverified)
            const retailersRes = await API.get('/admin/retailers');
            setRetailerCount(retailersRes.data.length);

            // Get ALL wholesalers (including pending/rejected)
            const wholesalersRes = await API.get('/admin/wholesalers');
            setWholesalerCount(wholesalersRes.data.length);
        } catch (err) {
            console.error('Fetch counts error:', err);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError('');

        try {
            const endpoint = userType === 'retailers' ? '/admin/retailers' : '/admin/wholesalers';
            const response = await API.get(endpoint);

            // Ensure each user has the correct fields
            const usersWithStatus = response.data.map(user => ({
                ...user,
                // For wholesalers: status comes from verification_status
                // For retailers: status comes from is_verified
                status: user.status || (user.is_verified ? 'approved' : 'pending'),
                is_active: user.is_active === 1 || user.is_active === true
            }));

            setUsers(usersWithStatus);
        } catch (err) {
            console.error('Fetch users error:', err);
            setError(err.response?.data?.message || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    // Verify a wholesaler
    const verifyWholesaler = async (wholesalerId) => {
        setActionLoading(true);
        try {
            await API.put(`/admin/verification/${wholesalerId}/approve`);
            await fetchUsers();
            await fetchCounts();
        } catch (err) {
            console.error('Verification error:', err);
            setError(err.response?.data?.message || 'Failed to verify wholesaler');
        } finally {
            setActionLoading(false);
        }
    };

    // Reject a wholesaler
    const rejectWholesaler = async (wholesalerId) => {
        setActionLoading(true);
        try {
            const reason = prompt('Enter rejection reason:');
            if (reason !== null) {
                await API.put(`/admin/verification/${wholesalerId}/reject`, { reason });
                await fetchUsers();
                await fetchCounts();
            }
        } catch (err) {
            console.error('Rejection error:', err);
            setError(err.response?.data?.message || 'Failed to reject wholesaler');
        } finally {
            setActionLoading(false);
        }
    };

    // Activate/Suspend a user
    const toggleUserStatus = async (userId, currentStatus) => {
        setActionLoading(true);
        try {
            const action = currentStatus ? 'suspend' : 'activate';
            await API.put(`/admin/${userType}/${userId}/${action}`);
            await fetchUsers();
            await fetchCounts();
        } catch (err) {
            console.error('Update user error:', err);
            setError(err.response?.data?.message || 'Failed to update user');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadgeClass = (status, isActive) => {
        // Check if user is suspended/inactive first
        if (isActive === false || isActive === 0) {
            return 'dash-status-suspended';
        }

        const statusMap = {
            'approved': 'dash-status-active',
            'active': 'dash-status-active',
            'pending': 'dash-status-pending',
            'rejected': 'dash-status-rejected',
            'suspended': 'dash-status-suspended'
        };
        return statusMap[status?.toLowerCase()] || 'dash-status-pending';
    };

    const getStatusLabel = (status, isActive) => {
        if (isActive === false || isActive === 0) {
            return 'Suspended';
        }

        const labelMap = {
            'approved': 'Approved',
            'active': 'Active',
            'pending': 'Pending',
            'rejected': 'Rejected'
        };
        return labelMap[status?.toLowerCase()] || status || 'Pending';
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-loading-spinner"></div>
                <p>Loading users...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dash-error">
                <icons.LuAlertCircle size={40} />
                <p>{error}</p>
                <button onClick={fetchUsers} className="dash-retry-btn">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="dash-users">
            <div className="dash-tabs">
                <button
                    className={`dash-tab ${userType === 'retailers' ? 'dash-tab-active' : ''}`}
                    onClick={() => setUserType('retailers')}
                >
                    <icons.LuStore size={16} />
                    Retailers ({retailerCount})
                </button>
                <button
                    className={`dash-tab ${userType === 'wholesalers' ? 'dash-tab-active' : ''}`}
                    onClick={() => setUserType('wholesalers')}
                >
                    <icons.LuBuilding2 size={16} />
                    Wholesalers ({wholesalerCount})
                </button>
            </div>

            <div className="dash-table-responsive">
                <table className="dash-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
                                    <icons.LuInbox size={32} />
                                    <p>No {userType} found</p>
                                </td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="dash-user-cell">
                                            <span className="dash-user-avatar">
                                                {user.name?.charAt(0).toUpperCase() || 'U'}
                                            </span>
                                            <span>{user.name || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td>{user.email || 'N/A'}</td>
                                    <td>{user.phone || 'N/A'}</td>
                                    <td>
                                        <span className={`dash-status ${getStatusBadgeClass(user.status, user.is_active)}`}>
                                            {getStatusLabel(user.status, user.is_active)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="dash-actions">
                                            {/* Wholesaler Verification Actions */}
                                            {userType === 'wholesalers' && user.status === 'pending' && (
                                                <>
                                                    <button
                                                        className="dash-btn-success dash-btn-sm"
                                                        onClick={() => verifyWholesaler(user.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <icons.LuCheck size={14} /> Verify
                                                    </button>
                                                    <button
                                                        className="dash-btn-danger dash-btn-sm"
                                                        onClick={() => rejectWholesaler(user.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <icons.LuX size={14} /> Reject
                                                    </button>
                                                </>
                                            )}

                                            {/* Activate/Suspend Button */}
                                            <button
                                                className={`dash-btn-sm ${user.is_active ? 'dash-btn-warning' : 'dash-btn-success'}`}
                                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                                                disabled={actionLoading}
                                            >
                                                {user.is_active ? (
                                                    <><icons.LuUserX size={14} /> Suspend</>
                                                ) : (
                                                    <><icons.LuUserCheck size={14} /> Activate</>
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


function VerificationSection() {
    const [pendingWholesalers, setPendingWholesalers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        fetchPendingWholesalers();
    }, []);

    const fetchPendingWholesalers = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await API.get('/admin/verification/pending');
            console.log('Fetched pending:', response.data);
            setPendingWholesalers(response.data);
        } catch (err) {
            console.error('Fetch pending error:', err);
            setError(err.response?.data?.message || 'Failed to load pending verifications');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        setActionLoading(id);
        try {
            await API.put(`/admin/verification/${id}/approve`);
            // Remove from list
            setPendingWholesalers(pendingWholesalers.filter(w => w.id !== id));
            alert('Wholesaler approved successfully!');
        } catch (err) {
            console.error('Approve error:', err);
            setError(err.response?.data?.message || 'Failed to approve');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id) => {
        const reason = prompt('Enter reason for rejection (optional):');
        setActionLoading(id);

        try {
            await API.put(`/admin/verification/${id}/reject`, { reason: reason || 'No reason provided' });
            setPendingWholesalers(pendingWholesalers.filter(w => w.id !== id));
            alert('Wholesaler rejected');
        } catch (err) {
            console.error('Reject error:', err);
            setError(err.response?.data?.message || 'Failed to reject');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="dash-verification">
                <div className="dash-placeholder">Loading pending verifications...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dash-verification">
                <div className="dash-placeholder" style={{ color: 'red' }}>Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="dash-verification">
            <div className="dash-table-responsive">
                {pendingWholesalers.length === 0 ? (
                    <div className="dash-placeholder">
                        <h3>No Pending Verifications</h3>
                        <p>All wholesalers have been verified.</p>
                    </div>
                ) : (
                    <table className="dash-table">
                        <thead>
                            <tr>
                                <th>Business Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Specialisation</th>
                                <th>Registration Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingWholesalers.map((wholesaler) => (
                                <tr key={wholesaler.id}>
                                    <td>{wholesaler.business_name}</td>
                                    <td>{wholesaler.email}</td>
                                    <td>{wholesaler.phone || 'N/A'}</td>
                                    <td>{wholesaler.specialisation?.replace('_', ' ') || 'N/A'}</td>
                                    <td>{new Date(wholesaler.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button
                                            className="dash-btn-success"
                                            onClick={() => handleApprove(wholesaler.id)}
                                            disabled={actionLoading === wholesaler.id}
                                        >
                                            {actionLoading === wholesaler.id ? '...' : 'Approve'}
                                        </button>
                                        <button
                                            className="dash-btn-danger"
                                            onClick={() => handleReject(wholesaler.id)}
                                            disabled={actionLoading === wholesaler.id}
                                        >
                                            Reject
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
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
// PLATFORM SETTINGS SECTION (with Categories)
// ============================================

function SettingsSection() {
    const [settingsTab, setSettingsTab] = useState('general');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', description: '' });
    const [editingCategory, setEditingCategory] = useState(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Fetch categories error:', error);
        } finally {
            setLoading(false);
        }
    };

    const addCategory = async () => {
        if (!newCategory.name.trim()) {
            alert('Category name is required');
            return;
        }

        try {
            const response = await API.post('/admin/categories', newCategory);
            setCategories([...categories, response.data]);
            setNewCategory({ name: '', description: '' });
            alert('Category added successfully');
        } catch (error) {
            console.error('Add category error:', error);
            alert(error.response?.data?.message || 'Failed to add category');
        }
    };

    const updateCategory = async () => {
        if (!editingCategory.name.trim()) return;

        try {
            await API.put(`/admin/categories/${editingCategory.category_id}`, editingCategory);
            setCategories(categories.map(cat =>
                cat.category_id === editingCategory.category_id ? editingCategory : cat
            ));
            setEditingCategory(null);
            alert('Category updated successfully');
        } catch (error) {
            console.error('Update category error:', error);
            alert('Failed to update category');
        }
    };

    const deleteCategory = async (categoryId) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return;

        try {
            await API.delete(`/admin/categories/${categoryId}`);
            setCategories(categories.filter(cat => cat.category_id !== categoryId));
            alert('Category deleted successfully');
        } catch (error) {
            console.error('Delete category error:', error);
            alert(error.response?.data?.message || 'Failed to delete category');
        }
    };

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'commission', label: 'Commission' },
        { id: 'payment', label: 'Payment' },
        { id: 'categories', label: 'Categories' },
    ];

    return (
        <div className="dash-settings">
            <div className="dash-settings-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`dash-settings-tab ${settingsTab === tab.id ? 'dash-settings-tab-active' : ''}`}
                        onClick={() => setSettingsTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="dash-settings-content">
                {settingsTab === 'general' && <GeneralSettings />}
                {settingsTab === 'commission' && <CommissionSettings />}
                {settingsTab === 'payment' && <PaymentSettings />}
                {settingsTab === 'categories' && (
                    <div className="dash-categories-section">
                        <h3>Product Categories</h3>
                        <p className="dash-categories-desc">
                            Categories help retailers find products. Wholesalers will select from these categories when adding products.
                        </p>

                        {/* Add New Category Form */}
                        <div className="dash-add-category">
                            <h4>Add New Category</h4>
                            <div className="dash-category-form">
                                <input
                                    type="text"
                                    placeholder="Category Name (e.g., Electronics)"
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Description (optional)"
                                    value={newCategory.description}
                                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                                />
                                <button onClick={addCategory} className="dash-btn-primary">
                                    + Add Category
                                </button>
                            </div>
                        </div>

                        {/* Categories List */}
                        <div className="dash-categories-list">
                            <h4>Existing Categories ({categories.length})</h4>
                            <div className="dash-table-responsive">
                                <table className="dash-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Category Name</th>
                                            <th>Slug</th>
                                            <th>Description</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="5">Loading...</td></tr>
                                        ) : categories.length === 0 ? (
                                            <tr><td colSpan="5">No categories yet. Add your first category above.</td></tr>
                                        ) : (
                                            categories.map(cat => (
                                                <tr key={cat.category_id}>
                                                    <td>{cat.category_id}</td>
                                                    <td>
                                                        {editingCategory?.category_id === cat.category_id ? (
                                                            <input
                                                                type="text"
                                                                value={editingCategory.name}
                                                                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                                            />
                                                        ) : (
                                                            cat.category_name
                                                        )}
                                                    </td>
                                                    <td>{cat.slug || 'generated'}</td>
                                                    <td>
                                                        {editingCategory?.category_id === cat.category_id ? (
                                                            <input
                                                                type="text"
                                                                value={editingCategory.description || ''}
                                                                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                                                            />
                                                        ) : (
                                                            cat.description || '-'
                                                        )}
                                                    </td>
                                                    <td>
                                                        {editingCategory?.category_id === cat.category_id ? (
                                                            <>
                                                                <button onClick={updateCategory} className="dash-btn-success">Save</button>
                                                                <button onClick={() => setEditingCategory(null)} className="dash-btn-secondary">Cancel</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => setEditingCategory(cat)} className="dash-btn-sm">Edit</button>
                                                                <button onClick={() => deleteCategory(cat.category_id)} className="dash-btn-danger">Delete</button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Placeholder components for other settings tabs
function GeneralSettings() { return <div className="dash-placeholder">General Settings Coming Soon...</div>; }
function CommissionSettings() { return <div className="dash-placeholder">Commission Settings Coming Soon...</div>; }
function PaymentSettings() { return <div className="dash-placeholder">Payment Settings Coming Soon...</div>; }
function ProductsSection() { return <div className="dash-placeholder"><h3>Product Moderation</h3><p>Flagged products will appear here.</p></div>; }

//==================================
// ORDERS ADMINS SIDE
//================================== 
function OrdersSection() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderDetails, setShowOrderDetails] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0
    });

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await API.get('/admin/orders');
            const ordersData = response.data;
            setOrders(ordersData);
            calculateStats(ordersData);
        } catch (err) {
            console.error('Fetch orders error:', err);
            setError(err.response?.data?.message || 'Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (ordersData) => {
        const statsData = {
            total: ordersData.length,
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0
        };

        ordersData.forEach(order => {
            const status = order.status?.toLowerCase() || 'pending';
            if (status === 'pending') statsData.pending++;
            else if (status === 'processing') statsData.processing++;
            else if (status === 'shipped') statsData.shipped++;
            else if (status === 'delivered') statsData.delivered++;
            else if (status === 'cancelled') statsData.cancelled++;
        });

        setStats(statsData);
    };

    const getFilteredOrders = () => {
        if (filter === 'all') return orders;
        return orders.filter(order =>
            order.status?.toLowerCase() === filter.toLowerCase()
        );
    };

    const getStatusBadgeClass = (status) => {
        const statusMap = {
            'delivered': 'order-status-delivered',
            'shipped': 'order-status-shipped',
            'processing': 'order-status-processing',
            'pending': 'order-status-pending',
            'cancelled': 'order-status-cancelled',
            'refunded': 'order-status-refunded'
        };
        return statusMap[status?.toLowerCase()] || 'order-status-pending';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatCurrency = (amount) => {
        return `KES ${parseFloat(amount || 0).toLocaleString()}`;
    };

    const viewOrderDetails = async (orderId) => {
        try {
            const response = await API.get(`/admin/orders/${orderId}`);
            setSelectedOrder(response.data);
            setShowOrderDetails(true);
        } catch (err) {
            console.error('Fetch order details error:', err);
            setError('Failed to load order details');
        }
    };

    const closeOrderDetails = () => {
        setShowOrderDetails(false);
        setSelectedOrder(null);
    };

    const filteredOrders = getFilteredOrders();

    if (loading) {
        return (
            <div className="order-loading">
                <div className="order-loading-spinner"></div>
                <p>Loading orders...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="order-error">
                <p>{error}</p>
                <button onClick={fetchOrders} className="order-retry-btn">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="order-module">
            {/* Stats Cards */}
            <div className="order-stats-grid">
                <div className="order-stat-card">
                    <div className="order-stat-info">
                        <h4 className="order-stat-value">{stats.total}</h4>
                        <p className="order-stat-label">Total Orders</p>
                    </div>
                </div>
                <div className="order-stat-card pending">
                    <div className="order-stat-info">
                        <h4 className="order-stat-value">{stats.pending}</h4>
                        <p className="order-stat-label">Pending</p>
                    </div>
                </div>
                <div className="order-stat-card processing">
                    <div className="order-stat-info">
                        <h4 className="order-stat-value">{stats.processing}</h4>
                        <p className="order-stat-label">Processing</p>
                    </div>
                </div>
                <div className="order-stat-card shipped">
                    <div className="order-stat-info">
                        <h4 className="order-stat-value">{stats.shipped}</h4>
                        <p className="order-stat-label">Shipped</p>
                    </div>
                </div>
                <div className="order-stat-card delivered">
                    <div className="order-stat-info">
                        <h4 className="order-stat-value">{stats.delivered}</h4>
                        <p className="order-stat-label">Delivered</p>
                    </div>
                </div>
                <div className="order-stat-card cancelled">
                    <div className="order-stat-info">
                        <h4 className="order-stat-value">{stats.cancelled}</h4>
                        <p className="order-stat-label">Cancelled</p>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="order-filter-tabs">
                <button
                    className={`order-filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({stats.total})
                </button>
                <button
                    className={`order-filter-tab ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilter('pending')}
                >
                    Pending ({stats.pending})
                </button>
                <button
                    className={`order-filter-tab ${filter === 'processing' ? 'active' : ''}`}
                    onClick={() => setFilter('processing')}
                >
                    Processing ({stats.processing})
                </button>
                <button
                    className={`order-filter-tab ${filter === 'shipped' ? 'active' : ''}`}
                    onClick={() => setFilter('shipped')}
                >
                    Shipped ({stats.shipped})
                </button>
                <button
                    className={`order-filter-tab ${filter === 'delivered' ? 'active' : ''}`}
                    onClick={() => setFilter('delivered')}
                >
                    Delivered ({stats.delivered})
                </button>
                <button
                    className={`order-filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setFilter('cancelled')}
                >
                    Cancelled ({stats.cancelled})
                </button>
            </div>

            {/* Orders Table */}
            <div className="order-table-wrap">
                {filteredOrders.length === 0 ? (
                    <div className="order-empty">
                        <p>No orders found</p>
                        <span className="order-empty-sub">Try changing the filter or check back later</span>
                    </div>
                ) : (
                    <table className="order-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Retailer</th>
                                <th>Wholesaler</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(order => (
                                <tr key={order.order_id}>
                                    <td className="order-id">
                                        <span className="order-number">
                                            {order.order_number || `ORD-${order.order_id}`}
                                        </span>
                                    </td>
                                    <td>{order.retailer || order.retailer_name || 'N/A'}</td>
                                    <td>{order.wholesaler || order.wholesaler_name || 'N/A'}</td>
                                    <td className="order-amount">{formatCurrency(order.total_amount)}</td>
                                    <td>{formatDate(order.order_date || order.paid_at || order.created_at)}</td>
                                    <td>
                                        <span className={`order-status ${getStatusBadgeClass(order.status)}`}>
                                            {order.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="order-view-btn"
                                            onClick={() => viewOrderDetails(order.order_id)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Order Details Modal */}
            {showOrderDetails && selectedOrder && (
                <div className="order-modal-overlay" onClick={closeOrderDetails}>
                    <div className="order-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="order-modal-header">
                            <h3>Order Details</h3>
                            <button className="order-modal-close" onClick={closeOrderDetails}>
                                ×
                            </button>
                        </div>
                        <div className="order-modal-body">
                            <div className="order-details-grid">
                                <div className="order-detail-item">
                                    <label>Order Number</label>
                                    <span>{selectedOrder.order_number || `ORD-${selectedOrder.order_id}`}</span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Status</label>
                                    <span className={`order-status ${getStatusBadgeClass(selectedOrder.status)}`}>
                                        {selectedOrder.status || 'Pending'}
                                    </span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Payment Status</label>
                                    <span className={`order-status ${selectedOrder.payment_status === 'paid' ? 'order-status-delivered' : 'order-status-pending'}`}>
                                        {selectedOrder.payment_status || 'Unpaid'}
                                    </span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Total Amount</label>
                                    <span className="order-amount">{formatCurrency(selectedOrder.total_amount)}</span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Retailer</label>
                                    <span>{selectedOrder.retailer_name || selectedOrder.retailer || 'N/A'}</span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Wholesaler</label>
                                    <span>{selectedOrder.wholesaler_name || selectedOrder.wholesaler || 'N/A'}</span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Order Date</label>
                                    <span>{formatDate(selectedOrder.paid_at || selectedOrder.created_at)}</span>
                                </div>
                                <div className="order-detail-item">
                                    <label>Shipping Address</label>
                                    <span>{selectedOrder.shipping_address || 'N/A'}</span>
                                </div>
                            </div>

                            {selectedOrder.items && selectedOrder.items.length > 0 && (
                                <div className="order-items-section">
                                    <h4>Order Items</h4>
                                    <table className="order-items-table">
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Quantity</th>
                                                <th>Unit Price</th>
                                                <th>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedOrder.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.product_name || 'Product'}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{formatCurrency(item.unit_price)}</td>
                                                    <td>{formatCurrency(item.total_price)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


function ReportsSection() { return <div className="dash-placeholder"><h3>Reports & Analytics</h3><p>Sales reports, user growth, exports.</p></div>; }

export default AdminDashboard;