import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  MoreVertical,
  Shield,
  Store,
  BadgeCheck,
  Eye,
  KeyRound,
  Ban,
  CheckCircle2,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
} from 'lucide-react';
import { adminAccountApi } from '../api/adminAccountApi.js';
import { PageLoader } from '../../../../components/feedback/PageLoader.jsx';
import './AccountListPage.css';

export function AccountListPage() {
  const [accounts, setAccounts] = useState([]);
  const [counts, setCounts] = useState({ all_count: 0, active_count: 0, inactive_count: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [search, setSearch] = useState('');
  const [relation, setRelation] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Active Dropdown Menu
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Copied User ID tooltip state
  const [copiedId, setCopiedId] = useState(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    status: 'ACTIVE',
  });
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Detail Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);

  // Reset Password Modal
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState(false);
  const [selectedUserForPwd, setSelectedUserForPwd] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetPwdSubmitting, setIsResetPwdSubmitting] = useState(false);
  const [resetPwdError, setResetPwdError] = useState('');

  // Deactivate / Activate Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminAccountApi.getAccounts({
        search,
        status: activeTab,
        relation,
        sort,
        page,
        limit: 10,
      });

      setAccounts(res.data.accounts || []);
      setCounts(res.data.counts || { all_count: 0, active_count: 0, inactive_count: 0 });
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [activeTab, relation, sort, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchAccounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Click outside menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest('.accounts-menu-wrap')) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyId = (userId) => {
    navigator.clipboard.writeText(userId);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Create Account Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password) {
      setCreateError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Mật khẩu phải từ 6 ký tự trở lên.');
      return;
    }

    try {
      setIsCreateSubmitting(true);
      setCreateError('');
      await adminAccountApi.createAccount(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({
        full_name: '',
        username: '',
        email: '',
        password: '',
        status: 'ACTIVE',
      });
      fetchAccounts();
    } catch (err) {
      setCreateError(err.message || 'Tạo tài khoản thất bại.');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  // Reset Password Handler
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setResetPwdError('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }

    try {
      setIsResetPwdSubmitting(true);
      setResetPwdError('');
      await adminAccountApi.resetPassword(selectedUserForPwd.id, newPassword);
      setIsResetPwdModalOpen(false);
      setSelectedUserForPwd(null);
      setNewPassword('');
      alert('Đặt lại mật khẩu thành công.');
    } catch (err) {
      setResetPwdError(err.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsResetPwdSubmitting(false);
    }
  };

  // Toggle Status Handler
  const handleToggleStatusSubmit = async () => {
    if (!selectedUserForStatus) return;
    const nextStatus = selectedUserForStatus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (nextStatus === 'INACTIVE' && !statusReason.trim()) {
      alert('Vui lòng nhập lý do vô hiệu hóa tài khoản.');
      return;
    }

    try {
      setIsStatusSubmitting(true);
      await adminAccountApi.toggleStatus(selectedUserForStatus.id, nextStatus, statusReason);
      setIsStatusModalOpen(false);
      setSelectedUserForStatus(null);
      setStatusReason('');
      fetchAccounts();
    } catch (err) {
      alert(err.message || 'Thay đổi trạng thái tài khoản thất bại.');
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  return (
    <div className="accounts-page">
      {/* --- Page Header --- */}
      <div className="accounts-header-row">
        <div className="accounts-title-group">
          <h1 className="accounts-main-title">Tài khoản</h1>
          <p className="accounts-subtitle">Quản lý tài khoản và quyền truy cập trên hệ thống.</p>
        </div>

        <button
          type="button"
          className="accounts-create-btn"
          onClick={() => {
            setCreateError('');
            setCreateForm({
              full_name: '',
              username: '',
              email: '',
              password: '',
              status: 'ACTIVE',
            });
            setIsCreateModalOpen(true);
          }}
        >
          <Plus size={18} />
          <span>Tạo tài khoản</span>
        </button>
      </div>

      {/* --- Status Tabs --- */}
      <div className="accounts-tabs-bar">
        <button
          type="button"
          className={`accounts-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ALL');
            setPage(1);
          }}
        >
          <span>Tất cả</span>
          <span className="accounts-tab-badge">
            {Number(counts.all_count || 0).toLocaleString()}
          </span>
        </button>

        <button
          type="button"
          className={`accounts-tab-btn ${activeTab === 'ACTIVE' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ACTIVE');
            setPage(1);
          }}
        >
          <span>Hoạt động</span>
          <span className="accounts-tab-badge">
            {Number(counts.active_count || 0).toLocaleString()}
          </span>
        </button>

        <button
          type="button"
          className={`accounts-tab-btn ${activeTab === 'INACTIVE' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('INACTIVE');
            setPage(1);
          }}
        >
          <span>Ngừng hoạt động</span>
          <span className="accounts-tab-badge">
            {Number(counts.inactive_count || 0).toLocaleString()}
          </span>
        </button>
      </div>

      {/* --- Table Card --- */}
      <div className="accounts-table-card">
        {/* Toolbar */}
        <div className="accounts-toolbar">
          <div className="accounts-search-wrap">
            <Search size={17} className="accounts-search-icon" />
            <input
              type="text"
              className="accounts-search-input"
              placeholder="Tìm tên, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="accounts-filters-right">
            <select
              className="accounts-select"
              value={relation}
              onChange={(e) => {
                setRelation(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả quan hệ / vai trò</option>
              <option value="OWNER">Owner (Chủ sở hữu)</option>
              <option value="MANAGER">Manager (Quản lý)</option>
              <option value="STAFF">Staff (Nhân viên)</option>
              <option value="UNASSIGNED">Chưa phân quyền</option>
            </select>

            <select
              className="accounts-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="name_asc">Tên (A - Z)</option>
              <option value="name_desc">Tên (Z - A)</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="accounts-alert-error" style={{ margin: '16px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Table */}
        <div className="accounts-table-container">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>TÀI KHOẢN</th>
                <th>QUYỀN TRUY CẬP</th>
                <th>TRẠNG THÁI</th>
                <th style={{ textAlign: 'right' }}>⋮</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '13.5px', color: '#737972' }}>
                        Đang tải danh sách tài khoản...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="accounts-empty-state">
                      <User size={36} style={{ margin: '0 auto 10px', color: '#a3bfa8' }} />
                      <div style={{ fontWeight: '600', color: '#191c19' }}>
                        Không tìm thấy tài khoản nào
                      </div>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((user) => {
                  const isMenuOpen = activeMenuId === user.id;
                  const isInactive = user.status !== 'ACTIVE';
                  const shortId = `#USR-${user.id.slice(0, 6).toUpperCase()}`;

                  return (
                    <tr key={user.id} className={isInactive ? 'inactive-row' : ''}>
                      <td>
                        <div className="accounts-user-col">
                          <div className="accounts-user-top">
                            <span className="accounts-user-name">
                              {user.full_name || user.username}
                            </span>
                            <span className="accounts-user-handle">@{user.username}</span>
                          </div>
                          <div className="accounts-user-sub">
                            <span className="accounts-user-email">{user.email}</span>
                            <span style={{ color: 'rgba(115, 121, 114, 0.4)' }}>•</span>
                            <span className="accounts-user-id-pill">
                              {shortId}
                              <button
                                type="button"
                                className="accounts-copy-btn"
                                onClick={() => handleCopyId(user.id)}
                                title="Sao chép toàn bộ ID"
                              >
                                {copiedId === user.id ? (
                                  <Check size={11} color="#3c5642" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`accounts-role-badge ${user.primary_role.toLowerCase().replace('_', '-')
                            }`}
                        >
                          {user.is_owner ? (
                            <Shield size={14} />
                          ) : user.primary_role === 'MANAGER' ? (
                            <Store size={14} />
                          ) : user.primary_role === 'STAFF' ? (
                            <BadgeCheck size={14} />
                          ) : null}
                          <span>{user.role_label}</span>
                        </span>
                      </td>

                      <td>
                        <span
                          className={`accounts-status-indicator ${user.status === 'ACTIVE' ? 'active' : 'inactive'
                            }`}
                        >
                          <span className="accounts-status-dot" />
                          <span>{user.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng HĐ'}</span>
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div
                          className="accounts-menu-wrap"
                          style={{ position: 'relative', display: 'inline-block' }}
                        >
                          <button
                            type="button"
                            className={`accounts-action-btn ${isMenuOpen ? 'active' : ''}`}
                            onClick={() =>
                              setActiveMenuId((prev) => (prev === user.id ? null : user.id))
                            }
                            title="Thao tác"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {isMenuOpen && (
                            <div className="accounts-menu-dropdown">
                              <button
                                type="button"
                                className="accounts-menu-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelectedUserDetail(user);
                                  setIsDetailModalOpen(true);
                                }}
                              >
                                <Eye size={15} color="#737972" />
                                <span>Xem chi tiết</span>
                              </button>

                              <button
                                type="button"
                                className="accounts-menu-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelectedUserForPwd(user);
                                  setNewPassword('');
                                  setResetPwdError('');
                                  setIsResetPwdModalOpen(true);
                                }}
                              >
                                <KeyRound size={15} color="#737972" />
                                <span>Đặt lại mật khẩu</span>
                              </button>

                              <div className="accounts-menu-divider" />

                              <button
                                type="button"
                                className={`accounts-menu-item ${user.status === 'ACTIVE' ? 'danger' : ''
                                  }`}
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelectedUserForStatus(user);
                                  setStatusReason('');
                                  setIsStatusModalOpen(true);
                                }}
                              >
                                {user.status === 'ACTIVE' ? (
                                  <>
                                    <Ban size={15} color="#ba1a1a" />
                                    <span>Vô hiệu hóa tài khoản</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={15} color="#3c5642" />
                                    <span style={{ color: '#3c5642' }}>Kích hoạt lại</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="accounts-pagination-footer">
          <div>
            <span style={{ fontWeight: '700', color: '#191c19' }}>
              {Number(pagination.total || 0).toLocaleString()}
            </span>{' '}
            tài khoản
          </div>

          <div className="accounts-pagination-controls">
            <button
              type="button"
              className="accounts-page-nav-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNumber = i + 1;
              if (pagination.totalPages > 5 && page > 3) {
                pageNumber = page - 2 + i;
                if (pageNumber > pagination.totalPages) {
                  pageNumber = pagination.totalPages - 4 + i;
                }
              }
              return (
                <button
                  key={pageNumber}
                  type="button"
                  className={`accounts-page-num-btn ${page === pageNumber ? 'active' : ''}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}

            {pagination.totalPages > 5 && page < pagination.totalPages - 2 && (
              <>
                <span style={{ padding: '0 4px', color: '#737972' }}>...</span>
                <button
                  type="button"
                  className={`accounts-page-num-btn ${page === pagination.totalPages ? 'active' : ''
                    }`}
                  onClick={() => setPage(pagination.totalPages)}
                >
                  {pagination.totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              className="accounts-page-nav-btn"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              title="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* Modal 1: Create Account */}
      {isCreateModalOpen && (
        <div className="accounts-modal-overlay">
          <div className="accounts-modal-container">
            <div className="accounts-modal-header">
              <h3 className="accounts-modal-title">Tạo tài khoản người dùng</h3>
              <button
                type="button"
                className="accounts-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="accounts-modal-body">
                {createError && (
                  <div className="accounts-alert-error">
                    <AlertCircle size={16} />
                    <span>{createError}</span>
                  </div>
                )}
                <div className="accounts-form-group">
                  <label className="accounts-form-label">Họ và tên</label>
                  <input
                    type="text"
                    className="accounts-form-input"
                    placeholder="VD: Nguyễn Văn A"
                    value={createForm.full_name}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                  />
                </div>

                <div className="accounts-form-group">
                  <label className="accounts-form-label">Tên đăng nhập (Username) *</label>
                  <input
                    type="text"
                    className="accounts-form-input"
                    placeholder="VD: nguyenvana"
                    value={createForm.username}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="accounts-form-group">
                  <label className="accounts-form-label">Email *</label>
                  <input
                    type="email"
                    className="accounts-form-input"
                    placeholder="VD: nguyenvana@gmail.com"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="accounts-form-group">
                  <label className="accounts-form-label">Mật khẩu khởi tạo *</label>
                  <input
                    type="password"
                    className="accounts-form-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="accounts-form-group">
                  <label className="accounts-form-label">Trạng thái ban đầu</label>
                  <select
                    className="accounts-form-select"
                    value={createForm.status}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <option value="ACTIVE">Hoạt động (Active)</option>
                    <option value="INACTIVE">Khóa tạm thời (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="accounts-modal-footer">
                <button
                  type="button"
                  className="accounts-btn-cancel"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreateSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="accounts-btn-submit"
                  disabled={isCreateSubmitting}
                >
                  {isCreateSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Tạo tài khoản'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Account Detail */}
      {isDetailModalOpen && selectedUserDetail && (
        <div className="accounts-modal-overlay">
          <div className="accounts-modal-container" style={{ maxWidth: '540px' }}>
            <div className="accounts-modal-header">
              <h3 className="accounts-modal-title">Thông tin chi tiết tài khoản</h3>
              <button
                type="button"
                className="accounts-modal-close-btn"
                onClick={() => setIsDetailModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="accounts-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3ede3', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#737972' }}>User ID</span>
                  <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: '600' }}>
                    {selectedUserDetail.id}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3ede3', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#737972' }}>Họ và tên</span>
                  <span style={{ fontSize: '13.5px', fontWeight: '700' }}>
                    {selectedUserDetail.full_name || '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3ede3', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#737972' }}>Tên đăng nhập</span>
                  <span style={{ fontSize: '13.5px', fontWeight: '600' }}>
                    @{selectedUserDetail.username}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3ede3', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#737972' }}>Email</span>
                  <span style={{ fontSize: '13.5px', fontWeight: '600' }}>
                    {selectedUserDetail.email}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3ede3', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#737972' }}>Trạng thái</span>
                  <span
                    className={`accounts-status-indicator ${selectedUserDetail.status === 'ACTIVE' ? 'active' : 'inactive'
                      }`}
                  >
                    <span className="accounts-status-dot" />
                    <span>
                      {selectedUserDetail.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                    </span>
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3ede3', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#737972' }}>Ngày đăng ký</span>
                  <span style={{ fontSize: '13px' }}>
                    {selectedUserDetail.created_at
                      ? new Date(selectedUserDetail.created_at).toLocaleString('vi-VN')
                      : 'N/A'}
                  </span>
                </div>

                {/* Brands Owned */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#191c19', marginBottom: '6px' }}>
                    Tổ chức sở hữu ({selectedUserDetail.owned_tenants?.length || 0})
                  </div>
                  {selectedUserDetail.owned_tenants && selectedUserDetail.owned_tenants.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedUserDetail.owned_tenants.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            background: '#f9f3e9',
                            borderRadius: '6px',
                            fontSize: '13px',
                          }}
                        >
                          <Building2 size={14} color="#3c5642" />
                          <span style={{ fontWeight: '600' }}>{t.name}</span>
                          <span style={{ color: '#737972', fontSize: '12px' }}>({t.slug})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#737972' }}>
                      Không sở hữu tổ chức nào.
                    </div>
                  )}
                </div>

                {/* Stores Assigned */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#191c19', marginBottom: '6px' }}>
                    Chi nhánh trực thuộc ({selectedUserDetail.staff_stores?.length || 0})
                  </div>
                  {selectedUserDetail.staff_stores && selectedUserDetail.staff_stores.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedUserDetail.staff_stores.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: '#f9f3e9',
                            borderRadius: '6px',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Store size={14} color="#3c5642" />
                            <span style={{ fontWeight: '600' }}>{s.name}</span>
                            {s.tenant_name && (
                              <span style={{ color: '#737972', fontSize: '12px' }}>
                                • {s.tenant_name}
                              </span>
                            )}
                          </div>
                          <span
                            className={`accounts-role-badge ${s.role?.toLowerCase() || 'staff'}`}
                          >
                            {s.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#737972' }}>
                      Chưa gán vào chi nhánh nào.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="accounts-modal-footer">
              <button
                type="button"
                className="accounts-btn-cancel"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Reset Password */}
      {isResetPwdModalOpen && selectedUserForPwd && (
        <div className="accounts-modal-overlay">
          <div className="accounts-modal-container">
            <div className="accounts-modal-header">
              <h3 className="accounts-modal-title">Đặt lại mật khẩu</h3>
              <button
                type="button"
                className="accounts-modal-close-btn"
                onClick={() => setIsResetPwdModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="accounts-modal-body">
                {resetPwdError && (
                  <div className="accounts-alert-error">
                    <AlertCircle size={16} />
                    <span>{resetPwdError}</span>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: '13.5px', color: '#191c19' }}>
                  Đặt lại mật khẩu cho tài khoản{' '}
                  <strong>{selectedUserForPwd.full_name || selectedUserForPwd.username}</strong> (@
                  {selectedUserForPwd.username}):
                </p>

                <div className="accounts-form-group">
                  <label className="accounts-form-label">Mật khẩu mới *</label>
                  <input
                    type="password"
                    className="accounts-form-input"
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="accounts-modal-footer">
                <button
                  type="button"
                  className="accounts-btn-cancel"
                  onClick={() => setIsResetPwdModalOpen(false)}
                  disabled={isResetPwdSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="accounts-btn-submit"
                  disabled={isResetPwdSubmitting}
                >
                  {isResetPwdSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Deactivate / Activate Account */}
      {isStatusModalOpen && selectedUserForStatus && (
        <div className="accounts-modal-overlay">
          <div className="accounts-modal-container">
            <div className="accounts-modal-header">
              <h3 className="accounts-modal-title">
                {selectedUserForStatus.status === 'ACTIVE'
                  ? 'Vô hiệu hóa tài khoản?'
                  : 'Kích hoạt lại tài khoản?'}
              </h3>
              <button
                type="button"
                className="accounts-modal-close-btn"
                onClick={() => setIsStatusModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="accounts-modal-body">
              {selectedUserForStatus.status === 'ACTIVE' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#ffdad6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ba1a1a',
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#191c19' }}>
                        Vô hiệu hóa tài khoản?
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#737972' }}>
                        <strong style={{ color: '#191c19' }}>
                          {selectedUserForStatus.full_name || selectedUserForStatus.username}
                        </strong>{' '}
                        sẽ không thể đăng nhập vào hệ thống.
                      </p>
                    </div>
                  </div>

                  <div className="accounts-form-group">
                    <label className="accounts-form-label">
                      Lý do <span style={{ color: '#ba1a1a' }}>*</span>
                    </label>
                    <textarea
                      className="accounts-form-textarea"
                      rows={3}
                      placeholder="Nhập lý do vô hiệu hóa tài khoản..."
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="accounts-alert-warning" style={{ background: '#edf5ee', borderColor: '#ccdac8', color: '#253f2c' }}>
                  <CheckCircle2 size={20} />
                  <span>
                    Tài khoản <strong>{selectedUserForStatus.full_name || selectedUserForStatus.username}</strong> sẽ được khôi phục quyền truy cập vào hệ thống.
                  </span>
                </div>
              )}
            </div>
            <div className="accounts-modal-footer">
              <button
                type="button"
                className="accounts-btn-cancel"
                onClick={() => setIsStatusModalOpen(false)}
                disabled={isStatusSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className={
                  selectedUserForStatus.status === 'ACTIVE'
                    ? 'accounts-btn-danger'
                    : 'accounts-btn-submit'
                }
                onClick={handleToggleStatusSubmit}
                disabled={isStatusSubmitting}
              >
                {isStatusSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : selectedUserForStatus.status === 'ACTIVE' ? (
                  'Vô hiệu hóa'
                ) : (
                  'Kích hoạt lại'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountListPage;
