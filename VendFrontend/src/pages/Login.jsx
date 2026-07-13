import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaGoogle, FaApple, FaEye, FaEyeSlash } from 'react-icons/fa';
import backImage from '../assets/logbckg.png';
import loginIllustration from '../assets/connectlogo.png';
import '../styling/login.css';

function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!password) {
            setError('Password is required');
            return;
        }

        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            if (result.data.userType === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }
        } else {
            setError(result.error);
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        // Navigate to forgot password page or open modal
        window.location.href = '/forgot-password';
    };

    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="login-page">
            {/* Background Image */}
            <div className="login-background">
                <img src={backImage} alt="Background" />
            </div>

            <div className="login-container">
                {/* Left Side - Login Form */}
                <div className="login-left">
                    <div className="login-form-wrapper">
                        <p className="login-subtitle">Login to your VendConnect account</p>

                        {error && <p className="login-error">{error}</p>}

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="login-field">
                                <input
                                    type="email"
                                    className="login-input"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                            </div>

                            <div className="login-field password-field">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="login-input"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={toggleShowPassword}
                                    tabIndex="-1"
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>

                            <div className="login-options">
                                <label className="login-remember">
                                    <input type="checkbox" /> Remember me
                                </label>
                                <button
                                    type="button"
                                    className="login-forgot"
                                    onClick={handleForgotPassword}
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="login-button"
                                disabled={loading}
                            >
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>

                        <div className="login-register-link">
                            Don't have an account?{' '}
                            <a href="/register" className="login-register-btn">
                                Create one here
                            </a>
                        </div>

                    </div>
                </div>

                {/* Right Side - Image/Illustration */}
                <div className="login-right">
                    <div className="login-illustration">
                        <img src={loginIllustration} alt="Login illustration" />
                        <div className="login-illustration-text">
                            <h2>VendConnect</h2>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;