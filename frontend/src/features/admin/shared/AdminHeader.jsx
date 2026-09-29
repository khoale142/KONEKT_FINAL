import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, ChevronDown, LogOut, User, Shield } from 'lucide-react';
import { useAdminAuth } from '../../../app/providers/AdminAuthProvider.jsx';
import { ADMIN_ROUTES } from '../../../constants/adminRoutes.js';

export function AdminHeader() {
  const navigate = useNavigate();
  const { adminUser, adminLogout } = useAdminAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fullName = adminUser?.fullName || 'Super Admin';
  const email = adminUser?.email || '';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await adminLogout();
    navigate(ADMIN_ROUTES.LOGIN, { replace: true });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="admin-header" data-purpose="admin-header">
      {/* Search Input Box */}
      <div className="admin-header-search-box">
        <Search size={18} className="admin-header-search-icon" />
        <input
          type="text"
          className="admin-header-search-input"
          placeholder="Tìm kiếm tổ chức, tài khoản, mã nhật ký..."
        />
      </div>

      {/* Header Actions & Profile */}
      <div className="admin-header-actions">
        {/* Environment Badge */}
        <div className="admin-env-badge">
          <span className="admin-env-dot" />
          <span>Môi trường Production</span>
        </div>

        {/* Action Buttons */}
        <button
          type="button"
          className="admin-icon-btn"
          aria-label="Thông báo hệ thống"
          title="Thông báo"
        >
          <Bell size={20} />
          <span className="admin-notif-dot" />
        </button>

        <button
          type="button"
          className="admin-icon-btn"
          aria-label="Trợ giúp"
          title="Tài liệu & Trợ giúp"
        >
          <HelpCircle size={20} />
        </button>

        <div className="admin-header-divider" />

        {/* Profile Menu */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            className="admin-profile-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="admin-avatar">{initials || 'AD'}</div>
            <div className="admin-profile-info">
              <span className="admin-profile-name">{fullName}</span>
              <span className="admin-profile-role">Super Administrator</span>
            </div>
            <ChevronDown size={16} color="#6f786b" />
          </button>

          {/* Profile Dropdown */}
          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '220px',
                backgroundColor: '#ffffff',
                border: '1px solid #d1c1a9',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(60, 86, 66, 0.15)',
                padding: '6px',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #eee6da',
                  marginBottom: '4px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#263426' }}>
                  {fullName}
                </div>
                <div style={{ fontSize: '11.5px', color: '#6f786b' }}>{email}</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate(ADMIN_ROUTES.PROFILE);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#263426',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f4eee4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <User size={16} color="#597d62" />
                <span>Hồ sơ & Bảo mật</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#9a5d5a',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginTop: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8ece9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={16} color="#9a5d5a" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
