import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../../../../app/providers/AdminAuthProvider.jsx';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import { ROUTES } from '../../../../constants/routes.js';
import './AdminLoginPage.css';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { adminUser, adminLogin } = useAdminAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [authStatus, setAuthStatus] = useState('idle'); // 'idle' | 'checking' | 'success'

  if (adminUser) {
    return <Navigate to={ADMIN_ROUTES.DASHBOARD} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.email.trim()) {
      nextErrors.email = 'Vui lòng nhập email quản trị.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Định dạng email không hợp lệ.';
    }

    if (!form.password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu.';
    } else if (form.password.length < 6) {
      nextErrors.password = 'Mật khẩu phải từ 6 ký tự trở lên.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) return;

    try {
      setAuthStatus('checking');

      // Call admin login API
      await adminLogin({
        email: form.email.trim(),
        password: form.password,
        remember,
      });

      setAuthStatus('success');

      setTimeout(() => {
        navigate(ADMIN_ROUTES.DASHBOARD, { replace: true });
      }, 700);
    } catch (err) {
      setAuthStatus('idle');
      setSubmitError(err.message || 'Email hoặc mật khẩu không chính xác.');
    }
  };

  return (
    <div className="admin-login-wrapper">
      {/* Background ambient lighting */}
      <div className="admin-glow-orb-1" aria-hidden="true" />
      <div className="admin-glow-orb-2" aria-hidden="true" />

      <main className="admin-login-container">
        {/* Header & Brand Identity */}
        <div className="admin-login-header">
          <div className="admin-brand-icon-box" aria-hidden="true">
            <Shield size={28} strokeWidth={2.2} />
          </div>
          <h1 className="admin-brand-title">KONEKT Admin Portal</h1>
          <p className="admin-brand-subtitle">Dành cho nhân sự nội bộ được ủy quyền.</p>
        </div>

        {/* Login Form Card */}
        <div className="admin-login-card">
          {submitError && (
            <div className="admin-login-alert admin-login-alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{submitError}</span>
            </div>
          )}

          <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="admin-email">
                Email quản trị
              </label>
              <div className="admin-input-wrapper">
                <span className="admin-input-icon">
                  <Mail size={18} />
                </span>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`admin-input ${errors.email ? 'admin-input-error' : ''}`}
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={handleChange}
                  disabled={authStatus !== 'idle'}
                  required
                />
              </div>
              {errors.email && <p className="admin-error-text">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div className="admin-form-group">
              <div className="admin-form-label-row">
                <label className="admin-form-label" htmlFor="admin-password">
                  Mật khẩu
                </label>
                <Link
                  to={ADMIN_ROUTES.FORGOT_PASSWORD}
                  className="admin-forgot-link"
                  tabIndex={authStatus !== 'idle' ? -1 : 0}
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="admin-input-wrapper">
                <span className="admin-input-icon">
                  <Lock size={18} />
                </span>
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`admin-input admin-input-has-suffix ${errors.password ? 'admin-input-error' : ''}`}
                  placeholder="••••••••••••"
                  value={form.password}
                  onChange={handleChange}
                  disabled={authStatus !== 'idle'}
                  required
                />
                <button
                  type="button"
                  className="admin-toggle-pwd-btn"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="admin-error-text">{errors.password}</p>}
            </div>

            {/* Remember Me Checkbox */}
            <div className="admin-form-utilities">
              <label className="admin-checkbox-label" htmlFor="admin-remember">
                <input
                  id="admin-remember"
                  name="remember"
                  type="checkbox"
                  className="admin-checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={authStatus !== 'idle'}
                />
                <span className="admin-checkbox-text">Ghi nhớ đăng nhập</span>
              </label>
            </div>

            {/* Submit Action Button */}
            <button
              id="submitButton"
              type="submit"
              className={`admin-submit-btn ${
                authStatus === 'checking'
                  ? 'state-submitting'
                  : authStatus === 'success'
                  ? 'state-success'
                  : ''
              }`}
              disabled={authStatus !== 'idle'}
            >
              {authStatus === 'idle' && (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={18} />
                </>
              )}
              {authStatus === 'checking' && (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Đang kiểm tra chứng chỉ an toàn...</span>
                </>
              )}
              {authStatus === 'success' && (
                <>
                  <CheckCircle2 size={18} />
                  <span>Xác thực thành công. Đang chuyển tiếp...</span>
                </>
              )}
            </button>

            {/* Back to POS / Store Login Link */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Link
                to={ROUTES.LOGIN}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#6f786b',
                  fontSize: '12px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#263426')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6f786b')}
              >
                <span>← Về trang Đăng nhập Bán hàng &amp; Quản lý (POS)</span>
              </Link>
            </div>
          </form>
        </div>

        {/* Footer Audit Notice */}
        <div className="admin-login-footer">
          <p className="admin-footer-primary">Chỉ dành cho nhân sự nội bộ</p>
          <p className="admin-footer-secondary">Các thao tác quản trị quan trọng được ghi nhận.</p>
        </div>
      </main>
    </div>
  );
}

export default AdminLoginPage;
