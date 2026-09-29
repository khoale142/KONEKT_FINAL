import { useState, useRef, useEffect } from 'react';
import { UserPlus, MoreVertical, User, UserMinus, X, Loader2 } from 'lucide-react';
import { adminTenantApi } from '../api/adminTenantApi.js';

export function TenantOwners({ tenant, onRefresh }) {
  const owners = tenant.owners || [];
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', username: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const menuContainerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuContainerRef.current && !event.target.closest('.owner-menu-wrap')) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!addForm.email.trim() && !addForm.username.trim()) {
      setAddError('Vui lòng nhập Email hoặc Tên đăng nhập.');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminTenantApi.addOwner(tenant.id, {
        email: addForm.email.trim(),
        username: addForm.username.trim(),
      });
      setIsAddModalOpen(false);
      setAddForm({ email: '', username: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      setAddError(err.message || 'Không thể thêm chủ sở hữu vào tổ chức.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOwner = async (owner) => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ quyền chủ sở hữu của ${owner.full_name || owner.username}?`)) {
      return;
    }
    setActiveMenuId(null);
    try {
      await adminTenantApi.removeOwner(tenant.id, owner.id);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Gỡ quyền chủ sở hữu thất bại.');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'US';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="tab-pane-stack" ref={menuContainerRef}>
      {/* Header Row */}
      <div className="tab-header-row">
        <div>
          <div className="tab-title-badge-row">
            <h2 className="card-heading">Chủ sở hữu</h2>
            <span className="count-pill">{owners.length}</span>
          </div>
          <p className="tab-subtitle">
            Danh sách tài khoản có quyền sở hữu và quản trị cao nhất tổ chức.
          </p>
        </div>

        <button
          type="button"
          className="tenant-btn-primary"
          onClick={() => {
            setAddError('');
            setIsAddModalOpen(true);
          }}
        >
          <UserPlus size={16} />
          <span>+ Thêm chủ sở hữu</span>
        </button>
      </div>

      {/* Owners List Card */}
      <div className="tenant-card-table">
        {owners.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6f786b' }}>
            <User size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#263426' }}>
              Chưa có chủ sở hữu nào
            </div>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              Thêm chủ sở hữu đầu tiên để quản trị tổ chức này.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {owners.map((owner, idx) => (
              <div key={owner.id} className="owner-row-item">
                <div className="owner-info-left">
                  <div className={`owner-avatar ${idx === 0 ? 'primary' : 'secondary'}`}>
                    {getInitials(owner.full_name || owner.username)}
                  </div>
                  <div>
                    <div className="owner-name-row">
                      <span className="owner-full-name">{owner.full_name || owner.username}</span>
                      <span className={`owner-role-badge ${idx === 0 ? 'primary' : ''}`}>
                        {idx === 0 ? 'Chủ sở hữu chính' : 'Đồng sở hữu'}
                      </span>
                    </div>
                    <div className="owner-sub-info">
                      <span className="owner-email">{owner.email || owner.username}</span>
                      <span>•</span>
                      <span>
                        Thêm ngày {owner.joined_at ? new Date(owner.joined_at).toLocaleDateString('vi-VN') : '14/10/2023'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* More Action Menu */}
                <div className="owner-menu-wrap" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="tenant-action-btn"
                    onClick={() => setActiveMenuId(activeMenuId === owner.id ? null : owner.id)}
                    aria-label="Thao tác"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {activeMenuId === owner.id && (
                    <div className="tenant-dropdown-menu">
                      <button
                        type="button"
                        className="tenant-dropdown-item"
                        onClick={() => {
                          setActiveMenuId(null);
                          alert(`Xem thông tin tài khoản: ${owner.full_name || owner.username}`);
                        }}
                      >
                        <User size={15} color="#6f786b" />
                        <span>Xem tài khoản</span>
                      </button>

                      <div className="tenant-dropdown-divider" />

                      <button
                        type="button"
                        className="tenant-dropdown-item danger"
                        onClick={() => handleRemoveOwner(owner)}
                      >
                        <UserMinus size={15} />
                        <span>Gỡ khỏi tổ chức</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Thêm chủ sở hữu */}
      {isAddModalOpen && (
        <div className="tenant-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="tenant-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tenant-modal-header">
              <h2 className="tenant-modal-title">Thêm chủ sở hữu vào tổ chức</h2>
              <button
                type="button"
                className="tenant-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="tenant-modal-form">
                {addError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#ffdad6',
                      color: '#93000a',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {addError}
                  </div>
                )}

                <p style={{ fontSize: '13px', color: '#6f786b', margin: 0 }}>
                  Nhập địa chỉ email hoặc tên tài khoản của người dùng đã có trên hệ thống để cấp quyền sở hữu tổ chức.
                </p>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="owner-email">
                    Email tài khoản *
                  </label>
                  <input
                    id="owner-email"
                    type="email"
                    className="tenant-form-input"
                    placeholder="user@konekt.vn"
                    value={addForm.email}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="owner-username">
                    Hoặc Tên đăng nhập
                  </label>
                  <input
                    id="owner-username"
                    type="text"
                    className="tenant-form-input"
                    placeholder="username"
                    value={addForm.username}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="tenant-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang thêm...</span>
                    </>
                  ) : (
                    <span>Thêm chủ sở hữu</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantOwners;
