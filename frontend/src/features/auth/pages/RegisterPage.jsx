import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, User, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { AuthLayout } from '../../../components/layout/AuthLayout.jsx';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.fullName || !formData.password || !formData.confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await register({
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        password: formData.password,
      });

      // Login/register success, select workspace next
      navigate(ROUTES.WORKSPACES, { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Đăng ký tài khoản"
      subtitle="Tạo tài khoản mới để bắt đầu sử dụng hệ thống."
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {error && (
          <div className="auth-error" role="alert">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="username" className="form-label">
            Tên đăng nhập
          </label>
          <div className="input-with-icon">
            <div className="input-icon">
              <User size={18} />
            </div>
            <input
              id="username"
              name="username"
              type="text"
              className="form-control"
              placeholder="Ví dụ: minicoffee_admin"
              value={formData.username}
              onChange={handleInputChange}
              disabled={isSubmitting}
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <div className="input-with-icon">
            <div className="input-icon">
              <Mail size={18} />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              placeholder="Ví dụ: admin@minicoffee.local"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isSubmitting}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="fullName" className="form-label">
            Họ và tên
          </label>
          <div className="input-with-icon">
            <div className="input-icon">
              <User size={18} />
            </div>
            <input
              id="fullName"
              name="fullName"
              type="text"
              className="form-control"
              placeholder="Ví dụ: Nguyễn Văn A"
              value={formData.fullName}
              onChange={handleInputChange}
              disabled={isSubmitting}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Mật khẩu
          </label>
          <div className="input-with-icon">
            <div className="input-icon">
              <KeyRound size={18} />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              placeholder="Nhập mật khẩu"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="form-label">
            Xác nhận mật khẩu
          </label>
          <div className="input-with-icon">
            <div className="input-icon">
              <KeyRound size={18} />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="form-control"
              placeholder="Nhập lại mật khẩu"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '8px' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' }}>
          Đã có tài khoản?{' '}
          <Link to={ROUTES.LOGIN} style={{ color: 'var(--color-primary)' }}>
            Đăng nhập ngay
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
