import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styling/register.css';
import * as icons from 'react-icons/lu';

function Register() {
    const { registerRetailer, registerWholesaler } = useAuth();
    const [userType, setUserType] = useState('retailer');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('mpesa');
    const [formData, setFormData] = useState({
        // Account fields
        email: '',
        password: '',
        confirmPassword: '',
        store_name: '',
        phone: '',
        address: '',
        
        // Payment fields (common)
        payment_method: 'mpesa',
        
        // M-Pesa fields
        mpesa_phone_number: '',
        mpesa_paybill_number: '',
        mpesa_account_number: '',
        
        // Bank fields
        bank_name: '',
        bank_account_name: '',
        bank_account_number: '',
        bank_branch: '',
        
        // Wholesaler specific
        business_license: '',
        tax_id: '',
        specialisation: 'electronics'
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handlePaymentMethodChange = (method) => {
        setPaymentMethod(method);
        setFormData({ ...formData, payment_method: method });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Validate payment details based on method
        if (paymentMethod === 'mpesa' && !formData.mpesa_phone_number) {
            setError('M-Pesa phone number is required');
            return;
        }
        if (paymentMethod === 'bank' && (!formData.bank_name || !formData.bank_account_number)) {
            setError('Bank name and account number are required');
            return;
        }

        setLoading(true);

        let result;
        if (userType === 'retailer') {
            const retailerData = {
                email: formData.email,
                password: formData.password,
                store_name: formData.store_name,
                phone: formData.phone,
                address: formData.address,
                payment_method: formData.payment_method,
                mpesa_phone_number: formData.mpesa_phone_number,
                bank_name: formData.bank_name,
                bank_account_name: formData.bank_account_name,
                bank_account_number: formData.bank_account_number,
                bank_branch: formData.bank_branch
            };
            result = await registerRetailer(retailerData);
        } else {
            const wholesalerData = {
                email: formData.email,
                password: formData.password,
                business_name: formData.store_name,
                phone: formData.phone,
                address: formData.address,
                business_license: formData.business_license || 'PENDING',
                tax_id: formData.tax_id || 'PENDING',
                specialisation: formData.specialisation,
                payment_method: formData.payment_method,
                mpesa_phone_number: formData.mpesa_phone_number,
                mpesa_paybill_number: formData.mpesa_paybill_number,
                mpesa_account_number: formData.mpesa_account_number,
                bank_name: formData.bank_name,
                bank_account_name: formData.bank_account_name,
                bank_account_number: formData.bank_account_number,
                bank_branch: formData.bank_branch
            };
            result = await registerWholesaler(wholesalerData);
        }

        if (result.success) {
            window.location.href = '/dashboard';
        } else {
            setError(result.error);
            setLoading(false);
        }
    };

    const specialisationOptions = [
        { value: 'electronics', label: 'Electronics' },
        { value: 'fashion_apparel', label: 'Fashion & Apparel' },
        { value: 'home_garden', label: 'Home & Garden' },
        { value: 'food_beverage', label: 'Food & Beverage' },
        { value: 'beauty_health', label: 'Beauty & Health' },
        { value: 'automotive', label: 'Automotive' },
        { value: 'other', label: 'Other' }
    ];

    const bankOptions = [
        { value: '', label: 'Select Bank' },
        { value: 'KCB Bank', label: 'KCB Bank' },
        { value: 'Equity Bank', label: 'Equity Bank' },
        { value: 'Cooperative Bank', label: 'Cooperative Bank' },
        { value: 'Stanbic Bank', label: 'Stanbic Bank' },
        { value: 'Absa Bank', label: 'Absa Bank' },
        { value: 'NCBA Bank', label: 'NCBA Bank' },
        { value: 'DTB', label: 'DTB' },
        { value: 'I&M Bank', label: 'I&M Bank' },
        { value: 'Other', label: 'Other' }
    ];

    return (
        <div className="reg-container">
            <div className="reg-card">
                <h2 className="reg-title">Create Your VendConnect Account</h2>
                
                <div className="reg-user-type">
                    <button
                        type="button"
                        className={`reg-type-btn ${userType === 'retailer' ? 'reg-type-active' : ''}`}
                        onClick={() => setUserType('retailer')}
                    >
                        <icons.LuShoppingBag size={20} style={{ marginRight: '8px' }} /> Retailer (Buyer)
                    </button>
                    <button
                        type="button"
                        className={`reg-type-btn ${userType === 'wholesaler' ? 'reg-type-active' : ''}`}
                        onClick={() => setUserType('wholesaler')}
                    >
                        <icons.LuFactory size={20} style={{ marginRight: '8px' }} /> Wholesaler (Seller)
                    </button>
                </div>

                {error && <p className="reg-error">{error}</p>}

                <form onSubmit={handleSubmit} className="reg-form">
                    {/* Account Information Section */}
                    <div className="reg-section-title">Account Information</div>
                    
                    <div className="reg-row">
                        <div className="reg-field reg-field-half">
                            <input
                                type="email"
                                name="email"
                                className="reg-input"
                                placeholder="Email Address"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="reg-field reg-field-half">
                            <input
                                type="text"
                                name="store_name"
                                className="reg-input"
                                placeholder={userType === 'retailer' ? 'Store Name' : 'Business Name'}
                                value={formData.store_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="reg-row">
                        <div className="reg-field reg-field-half">
                            <input
                                type="password"
                                name="password"
                                className="reg-input"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="reg-field reg-field-half">
                            <input
                                type="password"
                                name="confirmPassword"
                                className="reg-input"
                                placeholder="Confirm Password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="reg-row">
                        <div className="reg-field reg-field-half">
                            <input
                                type="tel"
                                name="phone"
                                className="reg-input"
                                placeholder="Phone Number"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="reg-field reg-field-half">
                            <input
                                type="text"
                                name="address"
                                className="reg-input"
                                placeholder="Business Address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    {/* Payment Information Section */}
                    <div className="reg-section-title">
                        {userType === 'retailer' ? 'Payment Method (How you will pay)' : 'Payment Method (How you will receive payouts)'}
                    </div>
                    
                    <div className="reg-payment-methods">
                        <button
                            type="button"
                            className={`reg-payment-btn ${paymentMethod === 'mpesa' ? 'reg-payment-active' : ''}`}
                            onClick={() => handlePaymentMethodChange('mpesa')}
                      >
                            <icons.LuSmartphone size={25} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            M-Pesa
                        </button>
                        <button
                            type="button"
                            className={`reg-payment-btn ${paymentMethod === 'bank' ? 'reg-payment-active' : ''}`}
                            onClick={() => handlePaymentMethodChange('bank')}
                        >
                             <icons.LuBanknote size={25} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                             Bank Transfer
                        </button>
                    </div>

                    {paymentMethod === 'mpesa' && (
                        <div className="reg-payment-details">
                            <div className="reg-field">
                                <input
                                    type="tel"
                                    name="mpesa_phone_number"
                                    className="reg-input"
                                    placeholder={userType === 'retailer' ? 'Your M-Pesa Phone Number' : 'M-Pesa Phone Number for Payouts'}
                                    value={formData.mpesa_phone_number}
                                    onChange={handleChange}
                                    required
                                />
                                <small className="reg-field-note">
                                    {userType === 'retailer' 
                                        ? 'You will pay using this M-Pesa number' 
                                        : 'Your payouts will be sent to this M-Pesa number'}
                                </small>
                            </div>
                            
                            {userType === 'wholesaler' && (
                                <>
                                    <div className="reg-row">
                                        <div className="reg-field reg-field-half">
                                            <input
                                                type="text"
                                                name="mpesa_paybill_number"
                                                className="reg-input"
                                                placeholder="Paybill Number (Optional)"
                                                value={formData.mpesa_paybill_number}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="reg-field reg-field-half">
                                            <input
                                                type="text"
                                                name="mpesa_account_number"
                                                className="reg-input"
                                                placeholder="Account Number (Optional)"
                                                value={formData.mpesa_account_number}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {paymentMethod === 'bank' && (
                        <div className="reg-payment-details">
                            <div className="reg-field">
                                <select
                                    name="bank_name"
                                    className="reg-select"
                                    value={formData.bank_name}
                                    onChange={handleChange}
                                    required
                                >
                                    {bankOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="reg-field">
                                <input
                                    type="text"
                                    name="bank_account_name"
                                    className="reg-input"
                                    placeholder="Account Holder Name"
                                    value={formData.bank_account_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            
                            <div className="reg-row">
                                <div className="reg-field reg-field-half">
                                    <input
                                        type="text"
                                        name="bank_account_number"
                                        className="reg-input"
                                        placeholder="Account Number"
                                        value={formData.bank_account_number}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="reg-field reg-field-half">
                                    <input
                                        type="text"
                                        name="bank_branch"
                                        className="reg-input"
                                        placeholder="Branch (Optional)"
                                        value={formData.bank_branch}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Wholesaler Specific Fields */}
                    {userType === 'wholesaler' && (
                        <>
                            <div className="reg-section-title">Business Details</div>
                            
                            <div className="reg-row">
                                <div className="reg-field reg-field-half">
                                    <input
                                        type="text"
                                        name="business_license"
                                        className="reg-input"
                                        placeholder="Business License (Optional)"
                                        value={formData.business_license}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="reg-field reg-field-half">
                                    <input
                                        type="text"
                                        name="tax_id"
                                        className="reg-input"
                                        placeholder="Tax ID / KRA PIN (Optional)"
                                        value={formData.tax_id}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="reg-field">
                                <select
                                    name="specialisation"
                                    className="reg-select"
                                    value={formData.specialisation}
                                    onChange={handleChange}
                                >
                                    {specialisationOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <button type="submit" className="reg-button" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>

                <p className="reg-footer">
                    Already have an account? <a href="/login" style={{ color: 'rgb(239, 129, 10)' }}>Login</a>
                </p>
            </div>
        </div>
    );
}

export default Register;