import { useState, useEffect } from 'react';
import { Store, Plus, KeyRound } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';

import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { apiClient } from '../../../services/apiClient.js';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';

export function StoreManagementPage() {
  const { workspace } = useAuth();
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchStores = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/tenants/${workspace.id}`);
      // The tenant API returns stores with storeId, storeName instead of id, name
      setStores(res.data?.stores?.map(s => ({
        ...s,
        id: s.storeId || s.id,
        name: s.storeName || s.name
      })) || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách chi nhánh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    try {
      setIsCreating(true);
      setError(null);
      
      const payload = {
        name: newStoreName.trim(),
        address: newStoreAddress.trim()
      };
      
      // Clone data from the first store if available
      if (stores.length > 0) {
        payload.sourceStoreId = stores[0].id;
      }
      
      await apiClient.post('/stores', payload);
      setSuccess('Tạo chi nhánh thành công. Dữ liệu đã được nhân bản.');
      setShowCreateModal(false);
      setNewStoreName('');
      setNewStoreAddress('');
      fetchStores();
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo chi nhánh.');
    } finally {
      setIsCreating(false);
    }
  };

  const regenerateInviteCode = async (storeId) => {
    try {
      if (!window.confirm('Bạn có chắc muốn tạo lại mã mời? Mã cũ sẽ không còn hiệu lực.')) return;
      
      const res = await apiClient.post(`/stores/${storeId}/regenerate-code`);
      setStores(stores.map(s => s.id === storeId ? { ...s, invite_code: res.data.inviteCode } : s));
      setSuccess('Đã tạo mã mời mới thành công.');
    } catch (err) {
      setError(err.message || 'Lỗi tạo mã mời.');
    }
  };

  return (
    <>
      <PageHeader 
        title="Quản lý chi nhánh" 
        actions={
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} style={{ marginRight: '6px' }} />
            Thêm chi nhánh
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginBottom: '1rem' }} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} style={{ marginBottom: '1rem' }} />}

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Tên chi nhánh</th>
                <th>Địa chỉ</th>
                <th>Mã mời (Invite Code)</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                    Chưa có chi nhánh nào.
                  </td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                        <Store size={18} color="var(--color-secondary)" />
                        {store.name}
                      </div>
                    </td>
                    <td>{store.address || <span style={{ color: 'var(--color-secondary)' }}>Chưa cập nhật</span>}</td>
                    <td>
                      <code style={{ background: 'var(--color-surface-container)', padding: '4px 8px', borderRadius: '4px', fontWeight: '600', letterSpacing: '1px' }}>
                        {store.invite_code}
                      </code>
                    </td>
                    <td>
                      <Button variant="outline" size="sm" onClick={() => regenerateInviteCode(store.id)}>
                        <KeyRound size={14} style={{ marginRight: '4px' }} />
                        Đổi mã
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Basic modal for creating store */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Thêm chi nhánh mới</h2>
            <form onSubmit={handleCreateStore}>
              <div className="form-group">
                <label className="form-label">Tên chi nhánh <span style={{color: 'red'}}>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  autoFocus
                  required
                  placeholder="VD: CN Quận 1"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Địa chỉ</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="VD: 123 Nguyễn Huệ"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isCreating}>
                  {isCreating ? 'Đang tạo...' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
