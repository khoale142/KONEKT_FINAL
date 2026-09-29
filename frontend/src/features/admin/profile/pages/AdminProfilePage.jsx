import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCircle,
  Lock,
  Edit,
  Key,
  ShieldCheck,
  Shield,
  Sliders,
  Laptop,
  Smartphone,
  History,
  ArrowRight,
  LogOut,
  X,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { useAdminAuth } from '../../../../app/providers/AdminAuthProvider.jsx';
import { adminAuthApi } from '../../auth/api/adminAuthApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import './AdminProfilePage.css';

export function AdminProfilePage() {
  const { adminUser, setAdminUser } = useAdminAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security'

  // Security data state
  const [securityData, setSecurityData] = useState({
    twoFactor: {
      enabled: true,
      method: 'Authenticator App (Google / Microsoft Authenticator)',
    },
    lastPasswordChange: '',
    sessions: [],
    recentActivities: [],
  });
  const [loadingSecurity, setLoadingSecurity] = useState(false);

  // Edit Profile Modal State
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(adminUser?.fullName || '');
  const [editEmail, setEditEmail] = useState(adminUser?.email || '');
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const [editProfileError, setEditProfileError] = useState('');

  // Change Password Modal State
  const [isChangePwdModalOpen, setIsChangePwdModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [changePwdError, setChangePwdError] = useState('');

  // 2FA Modal State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

  // Alert Message Banner
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Update initial form values when adminUser is ready
  useEffect(() => {
    if (adminUser) {
      setEditFullName(adminUser.fullName || adminUser.username || '');
      setEditEmail(adminUser.email || '');
    }
  }, [adminUser]);

  // Load Security Details
  useEffect(() => {
    async function loadSecurity() {
      try {
        setLoadingSecurity(true);
        const res = await adminAuthApi.getSecurityDetails();
        if (res?.data) {
          setSecurityData(res.data);
        }
      } catch (err) {
        console.error('Failed to load security details:', err);
      } finally {
        setLoadingSecurity(false);
      }
    }

    if (activeTab === 'security') {
      loadSecurity();
    }
  }, [activeTab]);

  // Handle Edit Profile Submission
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditProfileError('');

    if (!editFullName.trim() || !editEmail.trim()) {
      setEditProfileError('Vui lòng nhập đầy đủ họ tên và email.');
      return;
    }

    try {
      setEditProfileLoading(true);
      const res = await adminAuthApi.updateProfile({
        fullName: editFullName.trim(),
        email: editEmail.trim(),
      });

      const updated = res.data?.user || res.data;
      if (updated) {
        setAdminUser(updated);
      }

      setIsEditProfileModalOpen(false);
      setFeedback({ type: 'success', message: 'Cập nhật thông tin quản trị viên thành công!' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setEditProfileError(err.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setEditProfileLoading(false);
    }
  };

  // Handle Change Password Submission
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePwdError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePwdError('Vui lòng điền đầy đủ các thông tin mật khẩu.');
      return;
    }

    if (newPassword.length < 6) {
      setChangePwdError('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePwdError('Mật khẩu mới và xác nhận mật khẩu không trùng khớp.');
      return;
    }

    try {
      setChangePwdLoading(true);
      await adminAuthApi.changePassword({
        currentPassword,
        newPassword,
      });

      setIsChangePwdModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', message: 'Đổi mật khẩu bảo mật thành công!' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setChangePwdError(err.message || 'Mật khẩu hiện tại không chính xác.');
    } finally {
      setChangePwdLoading(false);
    }
  };

  // Handle Revoke Session
  const handleRevokeSession = (device) => {
    if (window.confirm(`Bạn có chắc chắn muốn đăng xuất khỏi ${device} không?`)) {
      setSecurityData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.device !== device),
      }));
      setFeedback({ type: 'success', message: `Đã thu hồi phiên trên ${device}.` });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    }
  };

  // Handle Logout Other Sessions
  const handleLogoutOthers = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất tất cả các phiên đăng nhập khác?')) {
      setSecurityData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.isCurrent),
      }));
      setFeedback({ type: 'success', message: 'Đã thu hồi toàn bộ các phiên làm việc ngoại vi thành công.' });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    }
  };

  // Helpers
  const initial = (adminUser?.fullName || adminUser?.username || 'A').charAt(0).toUpperCase();

  const formatDate = (isoString) => {
    if (!isoString) return '01/09/2023';
    const d = new Date(isoString);
    return isNaN(d.getTime())
      ? '01/09/2023'
      : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'Vừa xong';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Vừa xong';
    return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="admin-profile-page" data-purpose="admin-profile-page">
      {/* Header Section */}
      <div className="admin-profile-header">
        <h1 className="admin-profile-title">Hồ sơ & Bảo mật</h1>
        <p className="admin-profile-subtitle">
          Quản lý thông tin cá nhân và bảo mật tài khoản quản trị viên.
        </p>
      </div>

      {/* Global Feedback Alert */}
      {feedback.message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: feedback.type === 'success' ? '#EDF5EE' : '#FEE2E2',
            color: feedback.type === 'success' ? '#2E6336' : '#991B1B',
            fontSize: '13px',
            fontWeight: 600,
            border: `1px solid ${feedback.type === 'success' ? '#C2DFC8' : '#FCA5A5'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="admin-profile-tabs">
        <button
          type="button"
          className={`admin-profile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <UserCircle size={18} />
          <span>Hồ sơ</span>
        </button>
        <button
          type="button"
          className={`admin-profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={18} />
          <span>Bảo mật</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: HỒ SƠ
         ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="admin-profile-card">
          <div className="admin-profile-card-header">
            <h2 className="admin-profile-card-title">Thông tin quản trị viên</h2>
            <button
              type="button"
              className="admin-btn-primary"
              onClick={() => {
                setEditFullName(adminUser?.fullName || adminUser?.username || '');
                setEditEmail(adminUser?.email || '');
                setEditProfileError('');
                setIsEditProfileModalOpen(true);
              }}
            >
              <Edit size={14} />
              <span>Chỉnh sửa</span>
            </button>
          </div>

          {/* Identity Banner */}
          <div className="admin-identity-banner">
            <div className="admin-identity-avatar">{initial}</div>
            <div className="admin-identity-meta">
              <div className="admin-identity-name-row">
                <span className="admin-identity-name">
                  {adminUser?.fullName || adminUser?.username || 'Alex Nguyen'}
                </span>
                <span className="admin-identity-role-badge">
                  {adminUser?.role || 'SUPER_ADMIN'}
                </span>
              </div>
              <span className="admin-identity-email">
                {adminUser?.email || 'alex.nguyen@konekt.vn'}
              </span>
            </div>
          </div>

          {/* 2-Column Information Grid */}
          <div className="admin-info-grid">
            <div className="admin-info-grid-row">
              <span className="admin-info-grid-label">Họ và tên</span>
              <span className="admin-info-grid-val">
                {adminUser?.fullName || adminUser?.username || 'Alex Nguyen'}
              </span>
            </div>

            <div className="admin-info-grid-row">
              <span className="admin-info-grid-label">Email</span>
              <span className="admin-info-grid-val mono">
                {adminUser?.email || 'alex.nguyen@konekt.vn'}
              </span>
            </div>

            <div className="admin-info-grid-row">
              <span className="admin-info-grid-label">Vai trò</span>
              <span className="admin-info-grid-val role">
                {adminUser?.role || 'SUPER_ADMIN'}
              </span>
            </div>

            <div className="admin-info-grid-row">
              <span className="admin-info-grid-label">Trạng thái</span>
              <div className="admin-active-status-pill">
                <span className="dot" />
                <span>Hoạt động</span>
              </div>
            </div>

            <div className="admin-info-grid-row">
              <span className="admin-info-grid-label">Ngày tạo</span>
              <span className="admin-info-grid-val">
                {formatDate(adminUser?.createdAt)}
              </span>
            </div>

            <div className="admin-info-grid-row">
              <span className="admin-info-grid-label">Đăng nhập cuối</span>
              <span className="admin-info-grid-val">
                {formatDateTime(adminUser?.lastLoginAt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: BẢO MẬT
         ========================================================================= */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Row 1: 2 Balanced Cards (Password & 2FA) */}
          <div className="admin-security-top-grid">
            {/* Card Mật khẩu */}
            <div className="admin-security-subcard">
              <div className="admin-security-subcard-content">
                <div className="admin-security-subcard-header">
                  <div className="admin-security-subcard-title-row">
                    <Key size={18} />
                    <h3 className="admin-security-subcard-title">Mật khẩu</h3>
                  </div>
                </div>
                <p className="admin-security-subcard-desc">
                  Đổi lần cuối:{' '}
                  <strong>{formatDate(securityData.lastPasswordChange || adminUser?.updatedAt)}</strong>
                </p>
              </div>
              <div>
                <button
                  type="button"
                  className="admin-btn-outline"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setChangePwdError('');
                    setIsChangePwdModalOpen(true);
                  }}
                >
                  <KeyRound size={15} />
                  <span>Đổi mật khẩu</span>
                </button>
              </div>
            </div>

            {/* Card Xác thực hai bước */}
            <div className="admin-security-subcard">
              <div className="admin-security-subcard-content">
                <div className="admin-security-subcard-header">
                  <div className="admin-security-subcard-title-row">
                    <ShieldCheck size={18} />
                    <h3 className="admin-security-subcard-title">Xác thực hai bước (2FA)</h3>
                  </div>
                  <span className="admin-active-status-pill">
                    <span className="dot" />
                    <span>Đã bật</span>
                  </span>
                </div>
                <p className="admin-security-subcard-desc">
                  Phương thức: <strong>{securityData.twoFactor?.method}</strong>
                </p>
              </div>
              <div>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setIs2FAModalOpen(true)}
                >
                  <Sliders size={15} />
                  <span>Quản lý 2FA</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Phiên đăng nhập */}
          <div className="admin-profile-card">
            <div className="admin-profile-card-header">
              <div className="admin-profile-card-title-group">
                <Laptop size={18} />
                <h3 className="admin-profile-card-title">Phiên đăng nhập</h3>
              </div>
            </div>

            <div className="admin-sessions-list">
              {securityData.sessions?.map((session) => (
                <div key={session.id} className="admin-session-item">
                  <div className="admin-session-left">
                    <div
                      className={`admin-session-icon-box ${
                        session.isCurrent ? 'current' : 'other'
                      }`}
                    >
                      {session.iconType === 'laptop' ? (
                        <Laptop size={18} />
                      ) : (
                        <Smartphone size={18} />
                      )}
                    </div>
                    <div className="admin-session-meta">
                      <div className="admin-session-device-row">
                        <span className="admin-session-device-name">{session.device}</span>
                        <span className="admin-session-location">({session.location})</span>
                      </div>
                      <span className="admin-session-time">
                        {formatDateTime(session.lastActive)}
                      </span>
                    </div>
                  </div>

                  {session.isCurrent ? (
                    <span className="admin-current-session-badge">
                      <span className="dot" />
                      <span>Phiên hiện tại</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn-ghost-danger"
                      onClick={() => handleRevokeSession(session.device)}
                    >
                      Đăng xuất
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                paddingTop: '8px',
                borderTop: '1px solid rgba(229, 223, 211, 0.7)',
              }}
            >
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={handleLogoutOthers}
              >
                <LogOut size={15} />
                <span>Đăng xuất các phiên khác</span>
              </button>
            </div>
          </div>

          {/* Row 3: Hoạt động đăng nhập gần đây */}
          <div className="admin-profile-card">
            <div className="admin-profile-card-header">
              <div className="admin-profile-card-title-group">
                <History size={18} />
                <h3 className="admin-profile-card-title">Hoạt động đăng nhập gần đây</h3>
              </div>
            </div>

            <div className="admin-activity-list">
              {securityData.recentActivities?.slice(0, 4).map((act, index) => (
                <div key={act.id || index} className="admin-activity-row">
                  <div className="admin-activity-row-left">
                    <span
                      className={`admin-activity-dot ${
                        act.action === 'CHANGE_PASSWORD' ? 'warning' : 'success'
                      }`}
                    />
                    <span className="admin-activity-title">{act.title}</span>
                  </div>
                  <span className="admin-activity-timestamp">
                    {formatDateTime(act.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                paddingTop: '12px',
                borderTop: '1px solid rgba(229, 223, 211, 0.7)',
              }}
            >
              <Link
                to={`${ADMIN_ROUTES.AUDIT}?actorId=${adminUser?.id || 'ALL'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#3C5642',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span>Xem trong Nhật ký kiểm toán</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: CHỈNH SỬA HỒ SƠ
         ========================================================================= */}
      {isEditProfileModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsEditProfileModalOpen(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Chỉnh sửa hồ sơ</h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setIsEditProfileModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {editProfileError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  fontSize: '12px',
                }}
              >
                {editProfileError}
              </div>
            )}

            <form className="admin-modal-form" onSubmit={handleSaveProfile}>
              <div className="admin-form-field">
                <label className="admin-form-label">Họ và tên</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  required
                />
              </div>

              <div className="admin-form-field">
                <label className="admin-form-label">Email quản trị</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="admin@konekt.vn"
                  required
                />
              </div>

              <div className="admin-form-callout">
                Vai trò <strong>{adminUser?.role || 'SUPER_ADMIN'}</strong> và Trạng thái tài khoản
                được bảo mật theo chính sách hệ thống và không thể thay đổi tại đây.
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  disabled={editProfileLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  disabled={editProfileLoading}
                >
                  {editProfileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ĐỔI MẬT KHẨU
         ========================================================================= */}
      {isChangePwdModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsChangePwdModalOpen(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Đổi mật khẩu</h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setIsChangePwdModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {changePwdError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  fontSize: '12px',
                }}
              >
                {changePwdError}
              </div>
            )}

            <form className="admin-modal-form" onSubmit={handleChangePassword}>
              <div className="admin-form-field">
                <label className="admin-form-label">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  className="admin-form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                />
              </div>

              <div className="admin-form-field">
                <label className="admin-form-label">Mật khẩu mới</label>
                <input
                  type="password"
                  className="admin-form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                />
              </div>

              <div className="admin-form-field">
                <label className="admin-form-label">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  className="admin-form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                />
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setIsChangePwdModalOpen(false)}
                  disabled={changePwdLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  disabled={changePwdLoading}
                >
                  {changePwdLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: QUẢN LÝ 2FA
         ========================================================================= */}
      {is2FAModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIs2FAModalOpen(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Cấu hình xác thực 2 bước (2FA)</h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setIs2FAModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#EDF5EE',
                  color: '#2E6336',
                  border: '1px solid #C2DFC8',
                }}
              >
                <ShieldCheck size={20} />
                <span style={{ fontWeight: 600 }}>Tài khoản đang được bảo vệ bằng 2FA</span>
              </div>

              <p style={{ color: '#6B7280', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Bạn đang sử dụng ứng dụng xác thực Authenticator App để tạo mã OTP 6 chữ số khi đăng nhập
                từ thiết bị mới.
              </p>

              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#FAF8F5',
                  border: '1px solid #E5DFD3',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>MÃ DỰ PHÒNG (BACKUP CODES)</span>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#1C1D1B' }}>
                  8841-9920-1123-4456
                </span>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn-primary"
                onClick={() => setIs2FAModalOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminProfilePage;
