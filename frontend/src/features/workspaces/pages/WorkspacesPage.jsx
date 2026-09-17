import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Store, Plus, UserPlus, LogOut, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { apiClient } from '../../../services/apiClient.js';
import { ROUTES } from '../../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState({ ownedTenants: [], staffStores: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  
  // Modals state
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showJoinStore, setShowJoinStore] = useState(false);
  
  // Form state
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantAddress, setTenantAddress] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const { user, selectWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/workspaces');
      setWorkspaces(res.data || { ownedTenants: [], staffStores: [] });
      setError(null);
    } catch (err) {
      setError('Không thể tải danh sách nơi làm việc.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleSelectWorkspace = async (type, id) => {
    try {
      setIsJoining(true);
      await selectWorkspace({ workspaceType: type, workspaceId: id });
      if (type === WORKSPACE_TYPES.TENANT) {
        navigate(ROUTES.OWNER_DASHBOARD);
      } else {
        navigate(ROUTES.STORE_POS);
      }
    } catch (err) {
      alert('Lỗi khi truy cập: ' + (err.message || 'Không xác định'));
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!tenantName.trim()) return;
    try {
      setIsJoining(true);
      const res = await apiClient.post('/tenants', { 
        name: tenantName.trim(),
        email: tenantEmail.trim(),
        phone: tenantPhone.trim(),
        address: tenantAddress.trim()
      });
      setShowCreateTenant(false);
      setTenantName('');
      setTenantEmail('');
      setTenantPhone('');
      setTenantAddress('');
      
      // Auto select the new tenant
      await handleSelectWorkspace(WORKSPACE_TYPES.TENANT, res.data.id);
    } catch (err) {
      alert('Lỗi tạo thương hiệu: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleJoinStore = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      setIsJoining(true);
      const res = await apiClient.post('/stores/join', { inviteCode: inviteCode.trim() });
      setShowJoinStore(false);
      setInviteCode('');
      
      // Auto select the joined store
      await handleSelectWorkspace(WORKSPACE_TYPES.STORE, res.data.store.id);
    } catch (err) {
      alert('Lỗi tham gia: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="spin" size={48} color="var(--color-primary)" />
        <p style={{ color: 'var(--color-secondary)' }}>Đang tải danh sách nơi làm việc...</p>
      </div>
    );
  }

  const hasAnyWorkspace = workspaces.ownedTenants.length > 0 || workspaces.staffStores.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>Mini Coffee</h1>
            <p style={{ color: 'var(--color-secondary)', margin: '0.25rem 0 0 0' }}>Xin chào, {user?.fullName || user?.username}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </header>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Empty State */}
        {!hasAnyWorkspace && (
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '4rem 2rem', 
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}>
            <Building2 size={64} color="var(--color-primary-container)" style={{ margin: '0 auto 1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Chào mừng bạn đến với Mini Coffee</h2>
            <p style={{ color: 'var(--color-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
              Bạn chưa tham gia chi nhánh hay thương hiệu nào. Hãy tạo một thương hiệu mới để làm chủ hoặc tham gia chi nhánh bằng mã mời.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowCreateTenant(true)}
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
              >
                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                Tạo thương hiệu mới
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowJoinStore(true)}
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
              >
                <UserPlus size={18} style={{ marginRight: '0.5rem' }} />
                Tham gia chi nhánh
              </button>
            </div>
          </div>
        )}

        {/* Workspace Lists */}
        {hasAnyWorkspace && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Owned Tenants */}
            {workspaces.ownedTenants.length > 0 && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={20} color="var(--color-primary)" />
                    Thương hiệu của bạn (Quản trị)
                  </h2>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowCreateTenant(true)}
                  >
                    <Plus size={14} style={{ marginRight: '0.25rem' }} />
                    Tạo mới
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {workspaces.ownedTenants.map(tenant => (
                    <div 
                      key={tenant.tenantId}
                      onClick={() => !isJoining && handleSelectWorkspace(WORKSPACE_TYPES.TENANT, tenant.tenantId)}
                      style={{
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: '1px solid var(--color-outline-variant)',
                        cursor: isJoining ? 'wait' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        ':hover': {
                          borderColor: 'var(--color-primary)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                        }
                      }}
                      className="workspace-card"
                    >
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{tenant.tenantName}</h3>
                      <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.875rem' }}>
                        {tenant.stores.length} chi nhánh trực thuộc
                      </p>
                      <div style={{ marginTop: '1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: '500' }}>
                        Vào quản trị <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Staff Stores */}
            {workspaces.staffStores.length > 0 && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Store size={20} color="var(--color-primary)" />
                    Chi nhánh đang làm việc
                  </h2>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowJoinStore(true)}
                  >
                    <UserPlus size={14} style={{ marginRight: '0.25rem' }} />
                    Tham gia mã mời
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {workspaces.staffStores.map(store => (
                    <div 
                      key={store.storeId}
                      onClick={() => !isJoining && handleSelectWorkspace(WORKSPACE_TYPES.STORE, store.storeId)}
                      style={{
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: '1px solid var(--color-outline-variant)',
                        cursor: isJoining ? 'wait' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}
                      className="workspace-card"
                    >
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem' }}>{store.storeName}</h3>
                      <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.875rem' }}>
                        Thuộc: {store.tenantName}
                      </p>
                      <div style={{ marginTop: '1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: '500' }}>
                        Vào làm việc <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* Basic Modals inline for simplicity */}
      {showCreateTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Tạo thương hiệu mới</h2>
            <form onSubmit={handleCreateTenant}>
              <div className="form-group">
                <label className="form-label">Tên thương hiệu <span style={{color:'red'}}>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  autoFocus
                  required
                  placeholder="VD: The Coffee House"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email liên hệ</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="VD: contact@brand.com"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="VD: 0901234567"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Địa chỉ trụ sở</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="VD: 123 Nguyễn Huệ, Quận 1"
                  value={tenantAddress}
                  onChange={(e) => setTenantAddress(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateTenant(false)} disabled={isJoining}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isJoining}>
                  {isJoining ? 'Đang tạo...' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinStore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Tham gia chi nhánh</h2>
            <form onSubmit={handleJoinStore}>
              <div className="form-group">
                <label className="form-label">Mã mời (Invite Code)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  autoFocus
                  required
                  placeholder="VD: STORE-XYZ"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  disabled={isJoining}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowJoinStore(false)} disabled={isJoining}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isJoining}>
                  {isJoining ? 'Đang vào...' : 'Tham gia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .workspace-card:hover {
          border-color: var(--color-primary) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        }
      `}</style>
    </div>
  );
}
