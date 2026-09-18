import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Plus, ArrowRight, Loader2, Settings, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { apiClient } from '../../../services/apiClient.js';
import { ROUTES } from '../../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';

export function TenantStoreSelectPage() {
  const { workspace, selectWorkspace } = useAuth();
  const navigate = useNavigate();
  
  const [tenant, setTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [showCreateStore, setShowCreateStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');

  const fetchTenantDetails = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/tenants/${workspace.id}`);
      setTenant(res.data);
      setError(null);
    } catch (err) {
      setError('Không thể tải thông tin thương hiệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspace) {
      if (workspace.type === WORKSPACE_TYPES.TENANT) {
        fetchTenantDetails();
      } else if (workspace.type !== WORKSPACE_TYPES.STORE) {
        // If not TENANT and not STORE, they shouldn't be here
        navigate(ROUTES.WORKSPACES);
      }
    }
  }, [workspace, navigate]);

  const handleSelectStore = async (storeId) => {
    try {
      setIsJoining(true);
      await selectWorkspace({ workspaceType: WORKSPACE_TYPES.STORE, workspaceId: storeId });
      // This page requires a TENANT workspace. Reload after persisting the STORE
      // token so its route guard cannot redirect during the workspace transition.
      window.location.assign(ROUTES.STORE_POS);
    } catch (err) {
      alert('Lỗi truy cập chi nhánh: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    try {
      setIsJoining(true);
      const res = await apiClient.post('/stores', { 
        name: storeName.trim(),
        address: storeAddress.trim()
      });
      setShowCreateStore(false);
      setStoreName('');
      setStoreAddress('');
      
      await selectWorkspace({ workspaceType: WORKSPACE_TYPES.STORE, workspaceId: res.data.id });
      window.location.assign(ROUTES.STORE_POS);
    } catch (err) {
      alert('Lỗi tạo chi nhánh: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="spin" size={48} color="var(--color-primary)" />
        <p style={{ color: 'var(--color-secondary)' }}>Đang tải thông tin chi nhánh...</p>
      </div>
    );
  }

  const stores = tenant?.stores || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Navigation / Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <button 
            onClick={() => navigate(ROUTES.WORKSPACES)}
            className="btn btn-secondary btn-sm" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', background: 'transparent', border: 'none', padding: 0 }}
          >
            <ArrowLeft size={16} />
            Quay lại danh sách
          </button>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>
                {tenant?.name || 'Thương hiệu'}
              </h1>
              <p style={{ color: 'var(--color-secondary)', margin: '0.25rem 0 0 0' }}>
                Vui lòng chọn một chi nhánh để làm việc hoặc vào trang Quản trị chung.
              </p>
            </div>
            
            <button 
              onClick={() => navigate(ROUTES.OWNER_DASHBOARD)}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Settings size={18} />
              Quản trị chung
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Empty State */}
        {stores.length === 0 && (
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            padding: '4rem 2rem', 
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}>
            <Store size={64} color="var(--color-primary-container)" style={{ margin: '0 auto 1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Thương hiệu chưa có chi nhánh nào</h2>
            <p style={{ color: 'var(--color-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
              Hãy tạo chi nhánh đầu tiên của bạn để có thể bắt đầu bán hàng và quản lý doanh thu.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowCreateStore(true)}
              style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
            >
              <Plus size={18} style={{ marginRight: '0.5rem' }} />
              Tạo chi nhánh đầu tiên
            </button>
          </div>
        )}

        {/* Store List */}
        {stores.length > 0 && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={20} color="var(--color-primary)" />
                Danh sách chi nhánh
              </h2>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateStore(true)}
              >
                <Plus size={14} style={{ marginRight: '0.25rem' }} />
                Thêm chi nhánh
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {stores.map(store => (
                <div 
                  key={store.storeId || store.id}
                  onClick={() => !isJoining && handleSelectStore(store.storeId || store.id)}
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
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>{store.storeName || store.name}</h3>
                  <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.875rem' }}>
                    {store.address || 'Chưa cập nhật địa chỉ'}
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

      {/* Modal: Create Store */}
      {showCreateStore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Tạo chi nhánh mới</h2>
            <form onSubmit={handleCreateStore}>
              <div className="form-group">
                <label className="form-label">Tên chi nhánh <span style={{color:'red'}}>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  autoFocus
                  required
                  placeholder="VD: Chi nhánh Quận 1"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Địa chỉ</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="VD: 123 Nguyễn Huệ, Bến Nghé"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  disabled={isJoining}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateStore(false)} disabled={isJoining}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isJoining}>
                  {isJoining ? 'Đang tạo...' : 'Tạo & Vào làm việc'}
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
