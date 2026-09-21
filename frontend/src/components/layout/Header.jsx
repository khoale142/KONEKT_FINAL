import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User, Building2 } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { ROUTES } from '../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../constants/roles.js';

export function Header() {
  const { user, workspace, switchWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenProfile = () => {
    navigate(ROUTES.PROFILE);
  };

  const handleSwitchWorkspace = () => {
    switchWorkspace();
    navigate(ROUTES.WORKSPACES, { replace: true });
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      logout();
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {workspace && (
          <button
            type="button"
            onClick={handleSwitchWorkspace}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px' }}
          >
            <Building2 size={14} />
            <span>Đổi nơi làm việc</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenProfile}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px' }}
        >
          <Settings size={14} />
          <span>Hồ sơ</span>
        </button>

        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '8px',
              textAlign: 'left'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface-container-highest)',
                border: '1px solid var(--color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <User size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                {user?.fullName || user?.username || 'Nhân viên'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
                {!workspace
                  ? 'Chưa chọn nơi làm việc'
                  : workspace.type === WORKSPACE_TYPES.TENANT
                    ? 'Chủ doanh nghiệp'
                    : workspace.role === 'MANAGER'
                      ? 'Quản lý cửa hàng'
                      : 'Nhân viên'}
              </span>
            </div>
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '8px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: '8px',
                padding: '8px',
                minWidth: '160px',
                boxShadow: 'var(--shadow-md)',
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  width: '100%',
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-error)',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              >
                <LogOut size={16} />
                <span style={{ fontWeight: '500', fontSize: '14px' }}>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
