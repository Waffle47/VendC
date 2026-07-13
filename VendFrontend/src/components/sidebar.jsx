import * as icons from 'react-icons/lu';
import '../styling/Sidebar.css';

function Sidebar({ isOpen, onToggle, activeMenu, onMenuClick, user, onLogout, menuItems }) {
    // Get user display name
    const displayName = user?.name || user?.business_name || user?.store_name || user?.email || 'User';
    const userRole = user?.userType || 'User';

    // Get initial for avatar
    const getInitial = () => {
        const firstChar = displayName.charAt(0);
        return firstChar.toUpperCase();
    };

    return (
        <div className={`dash-sidebar ${isOpen ? 'dash-sidebar-open' : 'dash-sidebar-closed'}`}>
            <div className="dash-sidebar-header">
                {isOpen && <h2 className="dash-logo">VendConnect</h2>}
                <button className="dash-sidebar-toggle" onClick={onToggle}>
                    {isOpen ? '◀' : '▶'}
                </button>
            </div>

            <div className="dash-sidebar-content">
                {menuItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <button
                            key={item.id}
                            className={`dash-menu-item ${activeMenu === item.id ? 'dash-menu-item-active' : ''}`}
                            onClick={() => onMenuClick(item.id)}
                        >
                            <span className="dash-menu-icon">
                                {IconComponent ? <IconComponent size={20} /> : item.iconEmoji}
                            </span>
                            {isOpen && <span className="dash-menu-label">{item.label}</span>}
                        </button>
                    );
                })}
            </div>

            <div className="dash-sidebar-footer">
                <div className="dash-user-info">
                    <div className="dash-user-avatar">
                        {user?.profile_picture ? (
                            <img
                                src={user.profile_picture?.startsWith('http')
                                    ? user.profile_picture
                                    : `http://localhost:5000${user.profile_picture}`}
                                alt="Profile"
                                className="dash-user-avatar-img"
                            />
                        ) : (
                            <span className="dash-user-avatar-placeholder">
                                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                            </span>
                        )}
                    </div>
                    {isOpen && (
                        <div className="dash-user-details">
                            <p className="dash-user-name">{user?.name || user?.business_name || user?.store_name || user?.email}</p>
                            <p className="dash-user-role">{user?.userType || 'User'}</p>
                        </div>
                    )}
                </div>
                <button className="dash-logout-btn" onClick={onLogout}>
                    {isOpen ? 'Logout' : '🚪'}
                </button>
            </div>
        </div>
    );
}

export default Sidebar;