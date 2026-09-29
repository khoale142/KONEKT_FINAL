import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Mail, KeyRound, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { adminAuthApi } from '../api/adminAuthApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import './AdminLoginPage.css';

export function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    try {
      setIsLoading(true);
      await adminAuthApi.forgotPassword({ email: email.trim() });
      setSuccessMsg('Mã xác minh đã được gửi đến email quản trị của bạn.');
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Không thể gửi mã xác minh.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!token.trim()) {
      setError('Vui lòng nhập mã xác minh (OTP).');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setIsLoading(true);
      await adminAuthApi.resetPassword({
        email: email.trim(),
        token: token.trim(),
        newPassword,
      });
      setSuccessMsg('Mật khẩu quản trị đã được đặt lại thành công!');
      setTimeout(() => {
        navigate(ADMIN_ROUTES.LOGIN);
      }, 1500);
    } catch (err) {
      setError(err.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-glow-orb-1" aria-hidden="true" />
      <div className="admin-glow-orb-2" aria-hidden="true" />

      <main className="admin-login-container">
        {/* Header */}
        <div className="admin-login-header">
          <div className="admin-brand-icon-box" aria-hidden="true">
            <Shield size={28} strokeWidth={2.2} />
          </div>
          <h1 className="admin-brand-title">
            {step === 'request' ? 'Khôi phục mật khẩu' : 'Đặt lại mật khẩu'}
          </h1>
          <p className="admin-brand-subtitle">
            {step === 'request'
              ? 'Nhập email quản trị để nhận mã xác minh bảo mật.'
              : 'Nhập mã xác minh được gửi qua email và thiết lập mật khẩu mới.'}
          </p>
        </div>

        {/* Card */}
        <div className="admin-login-card">
          {error && (
            <div className="admin-login-alert admin-login-alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="admin-login-alert admin-login-alert-success" role="status">
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'request' ? (
            <form className="admin-login-form" onSubmit={handleRequestSubmit}>
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="reset-email">
                  Email quản trị
                </label>
                <div className="admin-input-wrapper">
                  <span className="admin-input-icon">
                    <Mail size={18} />
                  </span>
                  <input
                    id="reset-email"
                    type="email"
                    className="admin-input"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="admin-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang gửi mã...</span>
                  </>
                ) : (
                  <>
                    <span>Gửi mã xác minh</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <Link
                  to={ADMIN_ROUTES.LOGIN}
                  className="admin-forgot-link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Quay lại đăng nhập</span>
                </Link>
              </div>
            </form>
          ) : (
            <form className="admin-login-form" onSubmit={handleResetSubmit}>
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="otp-token">
                  Mã xác minh (OTP)
                </label>
                <div className="admin-input-wrapper">
                  <span className="admin-input-icon">
                    <KeyRound size={18} />
                  </span>
                  <input
                    id="otp-token"
                    type="text"
                    className="admin-input"
                    placeholder="Nhập mã 6 chữ số"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="new-pwd">
                  Mật khẩu mới
                </label>
                <div className="admin-input-wrapper">
                  <span className="admin-input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="new-pwd"
                    type={showPassword ? 'text' : 'password'}
                    className="admin-input admin-input-has-suffix"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="admin-toggle-pwd-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="confirm-pwd">
                  Xác nhận mật khẩu
                </label>
                <div className="admin-input-wrapper">
                  <span className="admin-input-icon">
                    <Lock size={18} />
                  </span>
                  <input
                    id="confirm-pwd"
                    type={showPassword ? 'text' : 'password'}
                    className="admin-input"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="admin-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <span>Đổi mật khẩu &amp; Hoàn tất</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="admin-forgot-link"
                  onClick={() => setStep('request')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Gửi lại mã xác minh</span>
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="admin-login-footer">
          <p className="admin-footer-primary">Chỉ dành cho nhân sự nội bộ</p>
          <p className="admin-footer-secondary">Các thao tác quản trị quan trọng được ghi nhận.</p>
        </div>
      </main>
    </div>
  );
}

export default AdminForgotPasswordPage;
