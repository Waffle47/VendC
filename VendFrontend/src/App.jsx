import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import WholesalerDashboard from './pages/WholesalerDashboard';
import RetailerDashboard from './pages/RetailerDashboard';

// Helper function to check if user is admin
const isAdmin = (user) => {
    return user && user.userType === 'admin';
};

// Protected route wrapper for admin only
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    
    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
    }
    
    if (user && isAdmin(user)) {
        return children;
    }
    
    return <Navigate to="/login" />;
};

// Protected route wrapper for any authenticated user
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuth();
    
    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
    }
    
    return user ? children : <Navigate to="/login" />;
};

// Main App component
function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

// Routes component
function AppRoutes() {
    const { user, loading } = useAuth();

    if (loading) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
    }

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Root path - redirect to login */}
            <Route path="/" element={<Navigate to="/login" />} />
            
            {/* Admin only route */}
            <Route 
                path="/admin" 
                element={
                    <AdminRoute>
                        <AdminDashboard />
                    </AdminRoute>
                } 
            />
            
            {/* Role-based dashboard - same /dashboard URL shows different content */}
            <Route 
                path="/dashboard" 
                element={
                    <PrivateRoute>
                        {user?.userType === 'admin' ? (
                            <Navigate to="/admin" />
                        ) : user?.userType === 'wholesaler' ? (
                            <WholesalerDashboard />
                        ) : user?.userType === 'retailer' ? (
                            <RetailerDashboard />
                        ) : (
                            <Navigate to="/login" />
                        )}
                    </PrivateRoute>
                } 
            />
            
            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
    );
}

export default App;