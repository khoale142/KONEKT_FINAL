import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Save } from 'lucide-react';
import { userApi } from '../api/userApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { PasswordInput } from '../../../components/forms/PasswordInput.jsx';
import { SelectInput } from '../../../components/forms/SelectInput.jsx';
import { formatDateTime } from '../../../utils/date.js';
import { validateDisplayName, validateEmail, validatePassword, validateUsername } from '../../../utils/validators.js';
import { ROUTES } from '../../../constants/routes.js';

const DEFAULT_FORM = {
  username: '',
  fullName: '',
  email: '',
  status: 'ACTIVE',
  password: '',
};

export function UserFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });
  const [metadata, setMetadata] = useState({ createdAt: '', lastLoginAt: '' });
  const [errors, setErrors] = useState({});
  const [resetErrors, setResetErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [resetError, setResetError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const loadUser = async () => {
      setIsLoading(true);
      setSubmitError('');

      try {
        const response = await userApi.getUser(id);
        const user = response.data.user;

        setForm({
          username: user.username || '',
          fullName: user.fullName || '',
          email: user.email || '',
          status: user.status || 'ACTIVE',
          password: '',
        });
        setMetadata({
          createdAt: user.createdAt || '',
          lastLoginAt: user.lastLoginAt || '',
        });
      } catch (loadError) {
        setSubmitError(loadError.message || 'Không tải được thông tin người dùng.');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [id, isEditMode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setSubmitError('');
  };

  const handleResetChange = (e) => {
    const { name, value } = e.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
    if (resetErrors[name]) {
      setResetErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setResetError('');
  };

  const validateUserForm = () => {
    const nextErrors = {
      fullName: validateDisplayName(form.fullName, 'Họ và tên'),
      email: validateEmail(form.email),
    };

    if (!isEditMode) {
      nextErrors.username = validateUsername(form.username);
      nextErrors.password = validatePassword(form.password);
    }

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const validateResetPasswordForm = () => {
    const nextErrors = {
      newPassword: validatePassword(resetForm.newPassword),
      confirmPassword: '',
    };

    if (!resetForm.confirmPassword) {
      nextErrors.confirmPassword = 'Xác nhận mật khẩu không được để trống.';
    } else if (resetForm.newPassword !== resetForm.confirmPassword) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setResetErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateUserForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      if (isEditMode) {
        await userApi.updateUser(id, {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          status: form.status,
        });
        setToastType('success');
        setToastMsg('Cập nhật người dùng thành công.');
      } else {
        await userApi.createUser({
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          status: form.status,
          password: form.password,
        });
        setToastType('success');
        setToastMsg('Tạo tài khoản thành công.');
        setTimeout(() => navigate(ROUTES.ADMIN_USERS), 900);
      }
    } catch (saveError) {
      setSubmitError(saveError.message || 'Lưu thông tin người dùng thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!validateResetPasswordForm()) {
      return;
    }

    setIsResettingPassword(true);
    setResetError('');

    try {
      await userApi.resetPassword(id, {
        newPassword: resetForm.newPassword,
      });
      setResetForm({ newPassword: '', confirmPassword: '' });
      setToastType('success');
      setToastMsg('Đặt lại mật khẩu thành công.');
    } catch (passwordError) {
      setResetError(passwordError.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title={isEditMode ? 'Chỉnh sửa người dùng' : 'Tạo tài khoản nội bộ'}
        description={
          isEditMode
            ? 'Cập nhật thông tin, quyền và trạng thái hoạt động của tài khoản.'
            : 'Admin tạo tài khoản nội bộ cho quản trị viên hoặc nhân viên.'
        }
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.ADMIN_USERS)} icon={<ArrowLeft size={16} />}>
            Quay lại danh sách
          </Button>
        }
      />

      {submitError && <Alert type="error" message={submitError} onClose={() => setSubmitError('')} />}

      <div className="responsive-split-layout">
        <div className="card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              <p style={{ color: 'var(--color-secondary)', margin: 0 }}>Đang tải thông tin người dùng...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <TextInput
                label="Tên đăng nhập"
                name="username"
                value={form.username}
                onChange={handleChange}
                error={errors.username}
                placeholder="ví dụ: staff01"
                required
                disabled={isEditMode || isSubmitting}
              />

              <TextInput
                label="Họ và tên"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                error={errors.fullName}
                placeholder="Nhập họ và tên"
                required
                maxLength={120}
                disabled={isSubmitting}
              />

              <TextInput
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="user@example.com"
                required
                maxLength={120}
                disabled={isSubmitting}
              />

              {!isEditMode && (
                <PasswordInput
                  label="Mật khẩu tạm"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  error={errors.password}
                  placeholder="Nhập mật khẩu tạm"
                  required
                  disabled={isSubmitting}
                />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: '12px' }}>
                <SelectInput
                  label="Trạng thái"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={[
                    { value: 'ACTIVE', label: 'Hoạt động' },
                    { value: 'INACTIVE', label: 'Ngưng hoạt động' },
                  ]}
                  disabled={isSubmitting}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.ADMIN_USERS)} disabled={isSubmitting}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting} icon={<Save size={16} />}>
                  {isEditMode ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="card">
            <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Thông tin nhanh</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
              <div>
                <strong>Username:</strong> {form.username || '-'}
              </div>
              <div>
                <strong>Trạng thái:</strong> {form.status === 'ACTIVE' ? ' Hoạt động' : ' Ngưng hoạt động'}
              </div>
              {isEditMode && (
                <>
                  <div>
                    <strong>Ngày tạo:</strong> {formatDateTime(metadata.createdAt) || '-'}
                  </div>
                  <div>
                    <strong>Lần đăng nhập cuối:</strong> {formatDateTime(metadata.lastLoginAt) || 'Chưa đăng nhập'}
                  </div>
                </>
              )}
            </div>
          </div>

          {isEditMode && (
            <div className="card">
              <h3 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Đặt lại mật khẩu</h3>
              <p style={{ color: 'var(--color-secondary)', fontSize: '14px', marginTop: 0 }}>
                Admin nhập mật khẩu mới để cấp lại quyền đăng nhập cho tài khoản này.
              </p>

              {resetError && <Alert type="error" message={resetError} onClose={() => setResetError('')} />}

              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <PasswordInput
                  label="Mật khẩu mới"
                  name="newPassword"
                  value={resetForm.newPassword}
                  onChange={handleResetChange}
                  error={resetErrors.newPassword}
                  placeholder="Nhập mật khẩu mới"
                  disabled={isResettingPassword}
                  required
                />

                <PasswordInput
                  label="Xác nhận mật khẩu mới"
                  name="confirmPassword"
                  value={resetForm.confirmPassword}
                  onChange={handleResetChange}
                  error={resetErrors.confirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={isResettingPassword}
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="secondary" loading={isResettingPassword} icon={<KeyRound size={16} />}>
                    Đặt lại mật khẩu
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}

export default UserFormPage;
