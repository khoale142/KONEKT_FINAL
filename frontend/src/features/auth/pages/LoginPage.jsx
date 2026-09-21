import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { validateEmail, validatePassword } from '../../../utils/validators.js';
import { ROUTES } from '../../../constants/routes.js';
import { authApi } from '../api/authApi.js';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot/Reset password views and states
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (user) {
    return <Navigate to={ROUTES.WORKSPACES} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    try {
      setIsSubmitting(true);
      await login({
        email: form.email.trim(),
        password: form.password,
      });
      navigate(ROUTES.WORKSPACES, { replace: true });
    } catch (err) {
      setSubmitError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    if (!forgotEmail.trim()) {
      setErrors({ forgotEmail: 'Email là bắt buộc.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.forgotPassword({
        email: forgotEmail.trim(),
        username: forgotEmail.trim()
      });
      setSuccessMessage('Mã xác nhận đã được gửi đến email của bạn.');
      setView('reset');
      setErrors({});
    } catch (err) {
      setSubmitError(err.message || 'Không thể gửi yêu cầu quên mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    const newErrors = {};
    if (!resetCode.trim()) newErrors.resetCode = 'Mã xác nhận là bắt buộc.';
    const passwordError = validatePassword(newPassword);
    if (passwordError) newErrors.newPassword = passwordError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.resetPassword({
        email: forgotEmail.trim(),
        username: forgotEmail.trim(),
        verificationCode: resetCode.trim(),
        newPassword: newPassword,
      });
      setSuccessMessage('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.');
      setView('login');
      setForm(prev => ({ ...prev, password: '' }));
      setErrors({});
    } catch (err) {
      setSubmitError(err.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="konekt-login-wrapper">
      {/* BEGIN: MainPortalWrapper */}
      <main className="konekt-login-container" data-purpose="login-container">
        {/* Outer elevated frame providing high contrast against background */}
        <div className="konekt-portal-card">
          
          {/* BEGIN: LeftFeaturePanel */}
          <section className="konekt-left-panel" data-purpose="brand-showcase">
            {/* Subtle atmospheric ambient glow */}
            <div className="konekt-glow-orb-1"></div>
            <div className="konekt-glow-orb-2"></div>

            {/* Top Header & Brand Identity */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <header className="konekt-brand-header">
                <div className="konekt-logo-box">
                  <div className="konekt-logo-icon">
                    {/* POS Terminal / Retail Monogram Icon */}
                    <svg style={{ width: '20px', height: '20px', color: '#6ee7b7' }} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
                      <rect height="14" rx="2" width="20" x="2" y="3"></rect>
                      <line x1="8" x2="16" y1="21" y2="21"></line>
                      <line x1="12" x2="12" y1="17" y2="21"></line>
                      <path d="M7 8h10"></path>
                    </svg>
                  </div>
                  <span className="konekt-brand-title">KONEKT</span>
                </div>
                {/* Category Badge */}
                <span className="konekt-category-badge">
                  POS &amp; Inventory Suite
                </span>
              </header>

              {/* Core Value Proposition */}
              <div className="konekt-value-prop">
                <h1 className="konekt-headline">
                  Vận hành nhà hàng &amp; chuỗi F&amp;B mượt mà hơn.
                </h1>
                <p className="konekt-subline">
                  Đồng bộ dữ liệu bán hàng, kho định lượng tự động và ca kíp nhân sự trên một hệ quản trị điện toán đám mây tập trung.
                </p>
              </div>

              {/* Feature Grid: 4 micro cards */}
              <div className="konekt-features-grid" data-purpose="features-summary">
                {/* Feature 1 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      {/* Zap / Fast Icon */}
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Order &amp; POS Siêu Tốc</h2>
                      <p className="konekt-feature-desc">Chốt hóa đơn dưới 3 giây</p>
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      {/* Inventory / Package Icon */}
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" x2="12" y1="22.08" y2="12"></line>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Kiểm Kho Tự Động</h2>
                      <p className="konekt-feature-desc">Trừ nguyên liệu real-time</p>
                    </div>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      {/* Bar Chart / Analytics Icon */}
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" x2="18" y1="20" y2="10"></line>
                        <line x1="12" x2="12" y1="20" y2="4"></line>
                        <line x1="6" x2="6" y1="20" y2="14"></line>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Báo Cáo Trực Quan</h2>
                      <p className="konekt-feature-desc">Doanh thu &amp; lãi gộp chi tiết</p>
                    </div>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      {/* Shield / Lock Icon */}
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Bảo Mật Phân Quyền</h2>
                      <p className="konekt-feature-desc">Theo chức danh &amp; ca làm</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Bottom Footer Status Indicator */}
            <div className="konekt-status-footer">
              <div className="konekt-status-indicator">
                <span className="konekt-pulse-wrapper">
                  <span className="konekt-pulse-ping"></span>
                  <span className="konekt-pulse-dot"></span>
                </span>
                <span style={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                  Máy chủ F&amp;B hoạt động ổn định (99.98%)
                </span>
              </div>
              <span className="konekt-version-tag">CLOUD v4.8</span>
            </div>
          </section>
          {/* END: LeftFeaturePanel */}

          {/* BEGIN: RightLoginPanel */}
          <section className="konekt-right-panel" data-purpose="login-form-section">
            <div className="konekt-edge-shadow"></div>

            {/* Center Floating Login Card */}
            <div className="konekt-floating-card">
              
              {/* Header Title */}
              <div className="konekt-form-header">
                <h2 className="konekt-form-title">
                  {view === 'login' ? 'Đăng nhập tài khoản' : view === 'forgot' ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}
                </h2>
                <p className="konekt-form-subtitle">
                  {view === 'login' 
                    ? 'Truy cập bảng điều khiển bán hàng và quản trị chuỗi' 
                    : view === 'forgot' 
                    ? 'Nhận mã xác nhận để khôi phục quyền truy cập' 
                    : 'Thiết lập mật khẩu an toàn mới cho tài khoản của bạn'}
                </p>
              </div>

              {submitError && (
                <div style={{ marginBottom: '16px' }}>
                  <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />
                </div>
              )}
              {successMessage && (
                <div style={{ marginBottom: '16px' }}>
                  <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />
                </div>
              )}

              {/* View 1: Login Form */}
              {view === 'login' && (
                <form onSubmit={handleSubmit} data-purpose="authentication-form">
                  {/* Email Input Field */}
                  <div className="konekt-form-group">
                    <label className="konekt-form-label" htmlFor="work-email">
                      Email công việc
                    </label>
                    <div className="konekt-input-wrapper">
                      <div className="konekt-input-icon">
                        {/* Mail Icon */}
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                      </div>
                      <input
                        id="work-email"
                        name="email"
                        type="email"
                        className={`konekt-input ${errors.email ? 'konekt-input-error' : ''}`}
                        placeholder="Ví dụ: quanly@konekt.vn"
                        value={form.email}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    {errors.email && <p className="konekt-error-text">{errors.email}</p>}
                  </div>

                  {/* Password Input Field */}
                  <div className="konekt-form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="konekt-form-label" htmlFor="password">
                        Mật khẩu
                      </label>
                    </div>
                    <div className="konekt-input-wrapper">
                      <div className="konekt-input-icon">
                        {/* Lock Icon */}
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className={`konekt-input ${errors.password ? 'konekt-input-error' : ''}`}
                        style={{ paddingRight: '40px' }}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        required
                      />
                      {/* Toggle Password Visibility Button */}
                      <button
                        type="button"
                        id="toggle-password-btn"
                        className="konekt-toggle-pwd-btn"
                        aria-label="Hiện hoặc ẩn mật khẩu"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.password && <p className="konekt-error-text">{errors.password}</p>}
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="konekt-form-utilities">
                    <label className="konekt-checkbox-label" htmlFor="remember-me">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        className="konekt-checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="konekt-checkbox-text">
                        Ghi nhớ đăng nhập
                      </span>
                    </label>
                    <button
                      type="button"
                      className="konekt-forgot-link"
                      onClick={() => {
                        setSubmitError('');
                        setSuccessMessage('');
                        setErrors({});
                        setView('forgot');
                      }}
                    >
                      Quên mật khẩu?
                    </button>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    className="konekt-submit-btn"
                    data-purpose="submit-btn"
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
                    <svg className="konekt-submit-arrow" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <line x1="5" x2="19" y1="12" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>

                  {/* Fast SSO Alternatives */}
                  <div className="konekt-sso-section">
                    <div className="konekt-sso-divider-wrapper">
                      <span className="konekt-sso-divider-badge">
                        Hoặc tiếp tục với
                      </span>
                    </div>
                    <div className="konekt-sso-grid" data-purpose="sso-options">
                      {/* Google Workspace SSO */}
                      <button
                        type="button"
                        className="konekt-sso-btn"
                        onClick={() => alert('Đăng nhập Google đang được tích hợp.')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"></path>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"></path>
                        </svg>
                        <span>Google</span>
                      </button>

                      {/* QR POS Code Quick Scan */}
                      <button
                        type="button"
                        className="konekt-sso-btn"
                        onClick={() => alert('Quét mã QR Ca Kíp đang được tích hợp.')}
                      >
                        <svg width="16" height="16" style={{ color: '#475569' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect height="7" width="7" x="3" y="3"></rect>
                          <rect height="7" width="7" x="14" y="3"></rect>
                          <rect height="7" width="7" x="14" y="14"></rect>
                          <rect height="7" width="7" x="3" y="14"></rect>
                        </svg>
                        <span>Mã QR Ca Kíp</span>
                      </button>
                    </div>
                  </div>

                  {/* Registration Link Footer */}
                  <footer className="konekt-register-footer">
                    Chưa có tài khoản KONEKT?{' '}
                    <Link to={ROUTES.REGISTER} className="konekt-register-link">
                      Đăng ký dùng thử 14 ngày
                    </Link>
                  </footer>
                </form>
              )}

              {/* View 2: Forgot Password Form */}
              {view === 'forgot' && (
                <form onSubmit={handleForgotPasswordSubmit}>
                  <div className="konekt-form-group">
                    <label className="konekt-form-label" htmlFor="forgot-email">
                      Email đăng ký
                    </label>
                    <div className="konekt-input-wrapper">
                      <div className="konekt-input-icon">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                      </div>
                      <input
                        id="forgot-email"
                        type="email"
                        className={`konekt-input ${errors.forgotEmail ? 'konekt-input-error' : ''}`}
                        placeholder="Nhập email của bạn"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    {errors.forgotEmail && <p className="konekt-error-text">{errors.forgotEmail}</p>}
                  </div>

                  <button
                    type="submit"
                    className="konekt-submit-btn"
                    style={{ marginTop: '16px' }}
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Đang gửi...' : 'Gửi mã xác nhận'}</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                      type="button"
                      className="konekt-forgot-link"
                      onClick={() => {
                        setSubmitError('');
                        setSuccessMessage('');
                        setView('login');
                      }}
                    >
                      ← Quay lại đăng nhập
                    </button>
                  </div>
                </form>
              )}

              {/* View 3: Reset Password Form */}
              {view === 'reset' && (
                <form onSubmit={handleResetPasswordSubmit}>
                  <div className="konekt-form-group">
                    <label className="konekt-form-label" htmlFor="reset-code">
                      Mã xác nhận (OTP)
                    </label>
                    <input
                      id="reset-code"
                      type="text"
                      className={`konekt-input ${errors.resetCode ? 'konekt-input-error' : ''}`}
                      placeholder="Nhập mã từ email"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                    {errors.resetCode && <p className="konekt-error-text">{errors.resetCode}</p>}
                  </div>

                  <div className="konekt-form-group">
                    <label className="konekt-form-label" htmlFor="new-password">
                      Mật khẩu mới
                    </label>
                    <div className="konekt-input-wrapper">
                      <div className="konekt-input-icon">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        className={`konekt-input ${errors.newPassword ? 'konekt-input-error' : ''}`}
                        style={{ paddingRight: '40px' }}
                        placeholder="Nhập mật khẩu mới"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                      <button
                        type="button"
                        className="konekt-toggle-pwd-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.newPassword && <p className="konekt-error-text">{errors.newPassword}</p>}
                  </div>

                  <button
                    type="submit"
                    className="konekt-submit-btn"
                    style={{ marginTop: '16px' }}
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Đang cập nhật...' : 'Đổi mật khẩu & Hoàn tất'}</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                      type="button"
                      className="konekt-forgot-link"
                      onClick={() => {
                        setSubmitError('');
                        setSuccessMessage('');
                        setView('login');
                      }}
                    >
                      ← Về trang đăng nhập
                    </button>
                  </div>
                </form>
              )}

            </div>

            {/* Help / Language Bar */}
            <div className="konekt-help-bar">
              <div className="konekt-help-link" onClick={() => window.open('tel:19006868')}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" x2="12" y1="16" y2="12"></line>
                  <line x1="12" x2="12.01" y1="8" y2="8"></line>
                </svg>
                <span>Hỗ trợ kỹ thuật: 1900 6868</span>
              </div>
              <div className="konekt-lang-toggle">
                <span className="konekt-lang-active">VI</span>
                <span>•</span>
                <span className="konekt-lang-inactive">EN</span>
              </div>
            </div>

          </section>
          {/* END: RightLoginPanel */}

        </div>
      </main>
      {/* END: MainPortalWrapper */}
    </div>
  );
}

export default LoginPage;
