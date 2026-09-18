import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User, Building2 } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { ROUTES } from '../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../constants/roles.js';

export function Header() {
  const { user, workspace, switchWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const handleOpenProfile = () => {
    navigate(ROUTES.PROFILE);
  };

  const handleSwitchWorkspace = () => {
    switchWorkspace();
    navigate(ROUTES.WORKSPACES, { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="label-md" style={{ color: 'var(--color-secondary)', fontWeight: '500' }}>
          SWT301 Project v1
        </span>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px' }}
        >
          <LogOut size={14} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
