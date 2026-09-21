import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { validateEmail, validatePassword } from '../../../utils/validators.js';
import { ROUTES } from '../../../constants/routes.js';
import './LoginPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, register } = useAuth();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    const newErrors = {};

    if (!form.fullName || form.fullName.trim().length < 2) {
      newErrors.fullName = 'Vui lòng nhập họ và tên đầy đủ (ít nhất 2 ký tự).';
    }

    const emailError = validateEmail(form.email);
    if (emailError) {
      newErrors.email = emailError;
    }

    const passwordError = validatePassword(form.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không trùng khớp.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        username: form.email,
        email: form.email,
        fullName: form.fullName.trim(),
        password: form.password,
      });

      navigate(ROUTES.WORKSPACES, { replace: true });
    } catch (err) {
      setSubmitError(err.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="konekt-login-wrapper">
      {/* BEGIN: MainPortalWrapper */}
      <main className="konekt-login-container" data-purpose="register-container">
        {/* Outer elevated frame providing high contrast against background */}
        <div className="konekt-portal-card">
          
          {/* BEGIN: LeftFeaturePanel */}
          <section className="konekt-left-panel" data-purpose="brand-showcase">
            {/* Atmospheric ambient glow */}
            <div className="konekt-glow-orb-1"></div>
            <div className="konekt-glow-orb-2"></div>

            {/* Top Header & Brand Identity */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <header className="konekt-brand-header">
                <div className="konekt-logo-box">
                  <div className="konekt-logo-icon">
                    {/* POS Monogram Icon */}
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
                  Khởi Tạo Nhanh
                </span>
              </header>

              {/* Core Value Proposition */}
              <div className="konekt-value-prop">
                <h1 className="konekt-headline">
                  Bắt đầu chuyển đổi số cùng KONEKT.
                </h1>
                <p className="konekt-subline">
                  Hệ thống POS &amp; Quản trị kho tự động chuẩn xác nhất cho chuỗi bán lẻ, siêu thị &amp; nhà hàng ẩm thực.
                </p>
              </div>

              {/* Feature Grid: 4 micro cards */}
              <div className="konekt-features-grid" data-purpose="features-summary">
                {/* Feature 1 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">14 Ngày Dùng Thử</h2>
                      <p className="konekt-feature-desc">Trọn bộ tính năng cao cấp không giới hạn</p>
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.651V9.35m0 0a3.001 3.001 0 003.75-.614A2.997 2.997 0 009.75 9.35m-6 0v-.001m6 0a3 3 0 003.75-.614 2.996 2.996 0 003.75.614m-7.5 0v-.001m7.5 0v-.001" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Quản Lý Chuỗi &amp; Kho</h2>
                      <p className="konekt-feature-desc">Tối ưu xuất nhập tồn, phân quyền chi nhánh</p>
                    </div>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Đồng Bộ Cloud Real-time</h2>
                      <p className="konekt-feature-desc">Vận hành mượt mà ngay cả khi ngắt kết nối</p>
                    </div>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="konekt-feature-card">
                  <div className="konekt-feature-content">
                    <div className="konekt-feature-icon">
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </div>
                    <div>
                      <h2 className="konekt-feature-title">Hỗ Trợ Triển Khai 1 - 1</h2>
                      <p className="konekt-feature-desc">Đội ngũ chuyên gia F&amp;B đồng hành cài đặt</p>
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

          {/* BEGIN: RightRegisterPanel */}
          <section className="konekt-right-panel" data-purpose="register-form-section">
            <div className="konekt-edge-shadow"></div>

            {/* Center Floating Card */}
            <div className="konekt-floating-card">
              
              {/* Header Title */}
              <div className="konekt-form-header">
                <h2 className="konekt-form-title">Tạo tài khoản quản trị</h2>
                <p className="konekt-form-subtitle">
                  Khởi tạo tài khoản dùng thử 14 ngày miễn phí.
                </p>
              </div>

              {submitError && (
                <div style={{ marginBottom: '16px' }}>
                  <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />
                </div>
              )}

              <form onSubmit={handleSubmit} data-purpose="registration-form">
                {/* Full Name Input Field */}
                <div className="konekt-form-group">
                  <label className="konekt-form-label" htmlFor="register-fullname">
                    Họ và tên
                  </label>
                  <div className="konekt-input-wrapper">
                    <div className="konekt-input-icon">
                      {/* User Icon */}
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                    <input
                      id="register-fullname"
                      name="fullName"
                      type="text"
                      className={`konekt-input ${errors.fullName ? 'konekt-input-error' : ''}`}
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={form.fullName}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  {errors.fullName && <p className="konekt-error-text">{errors.fullName}</p>}
                </div>

                {/* Email Input Field */}
                <div className="konekt-form-group">
                  <label className="konekt-form-label" htmlFor="register-email">
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
                      id="register-email"
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
                  <label className="konekt-form-label" htmlFor="register-password">
                    Mật khẩu
                  </label>
                  <div className="konekt-input-wrapper">
                    <div className="konekt-input-icon">
                      {/* Lock Icon */}
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`konekt-input ${errors.password ? 'konekt-input-error' : ''}`}
                      style={{ paddingRight: '40px' }}
                      placeholder="Tối thiểu 6 ký tự"
                      value={form.password}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
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

                {/* Confirm Password Input Field */}
                <div className="konekt-form-group">
                  <label className="konekt-form-label" htmlFor="register-confirm-password">
                    Xác nhận mật khẩu
                  </label>
                  <div className="konekt-input-wrapper">
                    <div className="konekt-input-icon">
                      {/* Lock Icon */}
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect height="11" rx="2" ry="2" width="18" x="3" y="11"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <input
                      id="register-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`konekt-input ${errors.confirmPassword ? 'konekt-input-error' : ''}`}
                      style={{ paddingRight: '40px' }}
                      placeholder="Nhập lại mật khẩu"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      className="konekt-toggle-pwd-btn"
                      aria-label="Hiện hoặc ẩn xác nhận mật khẩu"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
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
                  {errors.confirmPassword && <p className="konekt-error-text">{errors.confirmPassword}</p>}
                </div>

                {/* Terms Note */}
                <div className="konekt-terms-note">
                  Bằng việc đăng ký, bạn đồng ý với{' '}
                  <a href="#">Điều khoản dịch vụ</a> và{' '}
                  <a href="#">Chính sách bảo mật</a> của KONEKT.
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="konekt-submit-btn"
                  data-purpose="submit-btn"
                  disabled={isSubmitting}
                >
                  <span>{isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký dùng thử 14 ngày'}</span>
                  <svg className="konekt-submit-arrow" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <line x1="5" x2="19" y1="12" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>

                {/* SSO Section */}
                <div className="konekt-sso-section">
                  <div className="konekt-sso-divider-wrapper">
                    <span className="konekt-sso-divider-badge">
                      Hoặc tiếp tục với
                    </span>
                  </div>
                  <div className="konekt-sso-grid" data-purpose="sso-options">
                    <button
                      type="button"
                      className="konekt-sso-btn"
                      onClick={() => alert('Đăng ký với Google đang được tích hợp.')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"></path>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"></path>
                      </svg>
                      <span>Google</span>
                    </button>

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

                {/* Back to Login prompt */}
                <footer className="konekt-register-footer">
                  Đã có tài khoản KONEKT?{' '}
                  <Link to={ROUTES.LOGIN} className="konekt-register-link">
                    Đăng nhập ngay
                  </Link>
                </footer>
              </form>
            </div>

            {/* Help & Language Bar */}
            <div className="konekt-help-bar">
              <div className="konekt-help-link">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Trung tâm trợ giúp</span>
              </div>
              <div className="konekt-lang-toggle">
                <span className="konekt-lang-active">VN</span>
                <span>•</span>
                <span className="konekt-lang-inactive">EN</span>
              </div>
            </div>
          </section>
          {/* END: RightRegisterPanel */}

        </div>
      </main>
      {/* END: MainPortalWrapper */}
    </div>
  );
}

export default RegisterPage;
