import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';
import { ROUTES } from '../../../constants/routes.js';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { workspace } = useAuth();

  const handleGoBack = () => {
    if (workspace?.type === WORKSPACE_TYPES.TENANT) {
      navigate(ROUTES.OWNER_DASHBOARD, { replace: true });
    } else if (workspace?.type === WORKSPACE_TYPES.STORE) {
      navigate(ROUTES.STORE_POS, { replace: true });
    } else {
      navigate(ROUTES.WORKSPACES, { replace: true });
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 'var(--spacing-xl)',
      textAlign: 'center',
      backgroundColor: 'var(--color-background)',
      fontFamily: 'var(--font-family)'
    }}>
      <div style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-lg)' }}>
        <ShieldAlert size={64} />
      </div>
      <h1 className="headline-lg" style={{ color: 'var(--color-primary)', fontWeight: '700', marginBottom: '12px', margin: 0 }}>
        Truy cập bị từ chối
      </h1>
      <p style={{ color: 'var(--color-secondary)', fontSize: '14px', maxWidth: '380px', marginBottom: '24px', marginTop: '8px', lineHeight: '1.5', margin: 0 }}>
        Bạn không có quyền truy cập vào trang này. Vui lòng quay lại hoặc liên hệ quản trị viên.
      </p>
      <div style={{ marginTop: '24px' }}>
        <Button variant="primary" onClick={handleGoBack}>
          Quay lại trang chủ
        </Button>
      </div>
    </div>
  );
}
export default AccessDeniedPage;
