import { createContext, useState, useContext, useEffect } from 'react';
import API from '../api/axiosConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check if user is already logged in on page load
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (token && userData) {
            try {
                setUser(JSON.parse(userData));
            } catch (error) {
                console.error('Failed to parse user data:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    // LOGIN FUNCTION - receives email and password, sends to backend
    const login = async (email, password) => {
        try {
            const response = await API.post('/auth/login', { email, password });
            const userData = response.data;

            localStorage.setItem('token', userData.token);
            localStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            return { success: true, data: userData };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Login failed'
            };
        }
    };


    // Register Retailer
    const registerRetailer = async (formData) => {
        try {
            const response = await API.post('/auth/register/retailer', formData);
            const userData = response.data;

            localStorage.setItem('token', userData.token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            return { success: true, data: userData };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Registration failed'
            };
        }
    };



    // Register Wholesaler
    const registerWholesaler = async (formData) => {
        try {
            const response = await API.post('/auth/register/wholesaler', formData);
            const userData = response.data;

            localStorage.setItem('token', userData.token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            return { success: true, data: userData };
        } catch (error) {
            console.error('Registration error:', error.response?.data);
            return {
                success: false,
                error: error.response?.data?.message || 'Registration failed'
            };
        }
    };

    // Logout
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            login,
            registerRetailer,
            registerWholesaler,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};