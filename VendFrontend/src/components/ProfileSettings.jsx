import { useState, useRef } from 'react';
import * as icons from 'react-icons/lu';
import API from '../api/axiosConfig';
import '../styling/ProfileSettings.css';

function ProfileSettings({ user, onClose, onUpdate, isModal = true }) {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const fileInputRef = useRef(null);

    // Profile form state
    const [profileData, setProfileData] = useState({
        name: user?.name || user?.business_name || user?.store_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        profile_picture: user?.profile_picture || null,
    });

    // Password form state
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const handleProfileChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleProfilePictureClick = () => {
        fileInputRef.current?.click();
    };

    const handleProfilePictureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Image size should be less than 2MB' });
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setMessage({ type: 'error', text: 'Please upload an image file (JPEG, PNG, GIF, WEBP)' });
            return;
        }

        const formData = new FormData();
        formData.append('profile_picture', file);

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await API.post('/user/profile/picture', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const imageUrl = response.data.profile_picture;
            setProfileData({ ...profileData, profile_picture: imageUrl });
            setMessage({ type: 'success', text: 'Profile picture updated successfully!' });

            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.profile_picture = imageUrl;
            localStorage.setItem('user', JSON.stringify(storedUser));

            if (onUpdate) onUpdate();

        } catch (err) {
            console.error('Upload error:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Upload failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await API.put('/user/profile', {
                name: profileData.name,
                phone: profileData.phone,
                address: profileData.address,
            });

            setMessage({ type: 'success', text: response.data.message || 'Profile updated successfully!' });

            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.name = profileData.name;
            storedUser.phone = profileData.phone;
            storedUser.address = profileData.address;
            localStorage.setItem('user', JSON.stringify(storedUser));

            if (onUpdate) onUpdate(response.data.user);

        } catch (err) {
            console.error('Update error:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (passwordData.new_password !== passwordData.confirm_password) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (passwordData.new_password.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await API.put('/user/password', {
                current_password: passwordData.current_password,
                new_password: passwordData.new_password,
            });

            setMessage({ type: 'success', text: response.data.message || 'Password changed successfully!' });
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });

        } catch (err) {
            console.error('Password error:', err);
            setMessage({ type: 'error', text: err.response?.data?.message || 'Password change failed' });
        } finally {
            setLoading(false);
        }
    };

    const getInitials = () => {
        const name = profileData.name || user?.email || 'U';
        return name.charAt(0).toUpperCase();
    };

    const getProfileImageUrl = () => {
        if (profileData.profile_picture) {
            // If it's already a full URL, use it
            if (profileData.profile_picture.startsWith('http')) {
                return profileData.profile_picture;
            }
            // Otherwise, prepend the backend URL
            return `http://localhost:5000${profileData.profile_picture}`;
        }
        return null;
    };

    // If modal version, show overlay and modal
    if (isModal) {
        return (
            <div className="profile-settings-overlay">
                <div className="profile-settings-modal">
                    <div className="profile-settings-header">
                        <h2>Profile Settings</h2>
                        <button className="profile-settings-close" onClick={onClose}>
                            <icons.LuX size={24} />
                        </button>
                    </div>
                    {renderFormContent()}
                </div>
            </div>
        );
    }

    // If full page version, no overlay, just the content
    return (
        <div className="profile-settings-fullpage">
            <div className="profile-settings-header-fullpage">
            </div>
            {renderFormContent()}
        </div>
    );

    function renderFormContent() {
        return (
            <>
                <div className="profile-settings-tabs">
                    <button
                        className={`profile-tab ${activeTab === 'profile' ? 'profile-tab-active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <icons.LuUser size={16} /> Profile Information
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'password' ? 'profile-tab-active' : ''}`}
                        onClick={() => setActiveTab('password')}
                    >
                        <icons.LuLock size={16} /> Change Password
                    </button>
                </div>

                <div className="profile-settings-body-fullpage">
                    {message.text && (
                        <div className={`profile-message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="profile-form">
                            <div className="profile-picture-section">
                                <div className="profile-avatar" onClick={handleProfilePictureClick}>
                                    {getProfileImageUrl() ? (
                                        <img src={getProfileImageUrl()} alt="Profile" />
                                    ) : (
                                        <div className="profile-avatar-placeholder">
                                            {getInitials()}
                                        </div>
                                    )}
                                    <div className="profile-avatar-edit">
                                        <icons.LuCamera size={16} />
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleProfilePictureUpload}
                                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                    style={{ display: 'none' }}
                                />
                                <p className="profile-picture-hint">Click to change profile picture (max 2MB)</p>
                            </div>

                            <div className="profile-form-group">
                                <label>Full Name / Business Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={profileData.name}
                                    onChange={handleProfileChange}
                                    required
                                />
                            </div>

                            <div className="profile-form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    value={profileData.email}
                                    disabled
                                    className="profile-input-disabled"
                                />
                                <small>Email cannot be changed</small>
                            </div>

                            <div className="profile-form-group">
                                <label>Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={profileData.phone || ''}
                                    onChange={handleProfileChange}
                                    placeholder="Enter phone number"
                                />
                            </div>

                            <div className="profile-form-group">
                                <label>Business Address</label>
                                <textarea
                                    name="address"
                                    value={profileData.address || ''}
                                    onChange={handleProfileChange}
                                    placeholder="Enter business address"
                                    rows="3"
                                />
                            </div>

                            <button type="submit" className="profile-save-btn" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'password' && (
                        <form onSubmit={handleChangePassword} className="profile-form">
                            <div className="profile-form-group">
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    name="current_password"
                                    value={passwordData.current_password}
                                    onChange={handlePasswordChange}
                                    required
                                />
                            </div>

                            <div className="profile-form-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    name="new_password"
                                    value={passwordData.new_password}
                                    onChange={handlePasswordChange}
                                    required
                                />
                                <small>Minimum 6 characters</small>
                            </div>

                            <div className="profile-form-group">
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    name="confirm_password"
                                    value={passwordData.confirm_password}
                                    onChange={handlePasswordChange}
                                    required
                                />
                            </div>

                            <button type="submit" className="profile-save-btn" disabled={loading}>
                                {loading ? 'Changing...' : 'Change Password'}
                            </button>
                        </form>
                    )}
                </div>
            </>
        );
    }
}

export default ProfileSettings;