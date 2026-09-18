import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { AuthLayout } from '../../../components/layout/AuthLayout.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { PasswordInput } from '../../../components/forms/PasswordInput.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { validateEmail, validatePassword } from '../../../utils/validators.js';
import { ROUTES } from '../../../constants/routes.js';

import { authApi } from '../api/authApi.js';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Forgot/Reset password views and states
  const [view, setView] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // If already logged in, redirect to home
  if (user) {
    return <Navigate to={ROUTES.WORKSPACES} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setSubmitError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    
    // Validate email and password
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await login({
        email: form.email.trim(),
        password: form.password,
      });
      
      // Redirect to workspaces selection page
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

    const newErrors = {};
    if (!forgotEmail.trim()) {
      newErrors.forgotEmail = 'Email là bắt buộc.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
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
      setSubmitError(err.message || 'Yêu cầu đặt lại mật khẩu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setErrors({ newPassword: passwordError });
      return;
    }

    if (!resetCode) {
      setErrors({ resetCode: 'Mã xác nhận là bắt buộc.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.resetPassword({
        email: forgotEmail.trim(),
        token: resetCode.trim(),
        newPassword,
      });
      setSuccessMessage('Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.');
      setView('login');
      setNewPassword('');
      setResetCode('');
      setErrors({});
    } catch (err) {
      setSubmitError(err.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 24px 64px rgba(38, 52, 38, 0.06), 0 8px 16px rgba(38, 52, 38, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.7)',
        animation: 'fadeInSlide 0.6s ease-out',
        width: '100%'
      }}>
        {/* View Titles */}
        {view === 'login' && (
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', margin: 0, marginBottom: '8px', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
              Đăng nhập hệ thống
            </h2>
            <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: 0, fontWeight: '500' }}>
              Vui lòng điền thông tin tài khoản của bạn.
            </p>
          </div>
        )}

        {view === 'forgot' && (
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', margin: 0, marginBottom: '8px', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
              Quên mật khẩu
            </h2>
            <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: 0, fontWeight: '500' }}>
              Nhập email đã đăng ký của bạn để nhận mã xác nhận.
            </p>
          </div>
        )}

        {view === 'reset' && (
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--color-primary)', margin: 0, marginBottom: '8px', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
              Đặt lại mật khẩu
            </h2>
            <p style={{ color: 'var(--color-secondary)', fontSize: '14px', margin: 0, fontWeight: '500' }}>
              Nhập mã xác nhận từ email và mật khẩu mới của bạn.
            </p>
          </div>
        )}

        {/* Status Alerts */}
        {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}
        {successMessage && <Alert type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

        {/* View Forms */}
        {view === 'login' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <TextInput
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span>Email</span>
                </span>
              }
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="Nhập email của bạn"
              disabled={isSubmitting}
              required
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <PasswordInput
                label={
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-key-round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>
                    <span>Mật khẩu</span>
                  </span>
                }
                name="password"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="Nhập mật khẩu của bạn"
                disabled={isSubmitting}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setView('forgot');
                    setSubmitError('');
                    setSuccessMessage('');
                    setErrors({});
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <Button type="submit" variant="primary" loading={isSubmitting} style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(61, 80, 60, 0.15)',
                transition: 'all 0.2s ease-in-out'
              }}>
                Đăng nhập
              </Button>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' }}>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => navigate(ROUTES.REGISTER)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--color-primary)', 
                  fontWeight: '600', 
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline' 
                }}
              >
                Đăng ký ngay
              </button>
            </div>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <TextInput
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span>Địa chỉ Email</span>
                </span>
              }
              name="forgotEmail"
              type="email"
              value={forgotEmail}
              onChange={(e) => {
                setForgotEmail(e.target.value);
                setSubmitError('');
              }}
              error={errors.forgotEmail}
              placeholder="example@test.com"
              disabled={isSubmitting}
              required
            />

            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button type="submit" variant="primary" loading={isSubmitting} style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(61, 80, 60, 0.15)'
              }}>
                Gửi mã xác nhận
              </Button>
              
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setSubmitError('');
                  setSuccessMessage('');
                  setErrors({});
                  setForgotEmail('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <TextInput
              label={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span>Email</span>
                </span>
              }
              name="forgotEmail"
              value={forgotEmail}
              disabled={true}
              required
            />

            <TextInput
              label="Mã xác nhận (6 chữ số)"
              name="resetCode"
              value={resetCode}
              onChange={(e) => {
                setResetCode(e.target.value);
                setSubmitError('');
              }}
              error={errors.resetCode}
              placeholder="Nhập mã 6 chữ số"
              disabled={isSubmitting}
              required
              maxLength={6}
            />

            <PasswordInput
              label="Mật khẩu mới"
              name="newPassword"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setSubmitError('');
              }}
              error={errors.newPassword}
              placeholder="Nhập mật khẩu mới của bạn"
              disabled={isSubmitting}
              required
            />

            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button type="submit" variant="primary" loading={isSubmitting} style={{ 
                width: '100%', 
                padding: '12px', 
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(61, 80, 60, 0.15)'
              }}>
                Đặt lại mật khẩu
              </Button>
              
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setSubmitError('');
                  setSuccessMessage('');
                  setErrors({});
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        )}

      </div>
    </AuthLayout>
  );
}
export default LoginPage;
