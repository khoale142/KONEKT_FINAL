import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  MoreHorizontal,
  Edit,
  Ban,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Users,
  Store as StoreIcon,
  ShieldCheck,
  KeyRound,
  UserPlus,
  Search,
  RefreshCw,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { adminStoreApi } from '../api/adminStoreApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import { PageLoader } from '../../../../components/feedback/PageLoader.jsx';
import './StoreDetailPage.css';

export function StoreDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'members'

  // Header Dropdown Menu
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);

  // Copy States
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInviteCode, setCopiedInviteCode] = useState(false);

  // Edit Store Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '' });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Regenerate Invite Code Modal
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  const [isRegenSubmitting, setIsRegenSubmitting] = useState(false);
  const [regenSuccessCode, setRegenSuccessCode] = useState('');

  // Deactivate/Activate Store Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  // Members Tab State
  const [memberSearch, setMemberSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'MANAGER' | 'STAFF'
  const [activeMemberMenuId, setActiveMemberMenuId] = useState(null);

  // Add Member Modal
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({ identifier: '', role: 'STAFF' });
  const [isAddMemberSubmitting, setIsAddMemberSubmitting] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  // Change Member Role Modal
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [newRole, setNewRole] = useState('STAFF');
  const [isChangeRoleSubmitting, setIsChangeRoleSubmitting] = useState(false);

  // Remove Member Modal
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [isRemoveMemberSubmitting, setIsRemoveMemberSubmitting] = useState(false);

  const fetchStore = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminStoreApi.getStore(id);
      setStore(res.data);
      setEditForm({
        name: res.data.name || '',
        address: res.data.address || '',
      });
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin cửa hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, [id]);

  // Click outside to close menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setIsHeaderMenuOpen(false);
      }
      if (!event.target.closest('.store-member-menu-container')) {
        setActiveMemberMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyId = () => {
    if (!store) return;
    const text = store.id;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyInviteCode = () => {
    if (!store?.invite_code) return;
    navigator.clipboard.writeText(store.invite_code);
    setCopiedInviteCode(true);
    setTimeout(() => setCopiedInviteCode(false), 2000);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setEditError('Tên cửa hàng không được để trống.');
      return;
    }

    try {
      setIsEditSubmitting(true);
      setEditError('');
      const res = await adminStoreApi.updateStore(id, editForm);
      setStore((prev) => ({ ...prev, ...res.data }));
      setIsEditModalOpen(false);
    } catch (err) {
      setEditError(err.message || 'Cập nhật cửa hàng thất bại.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!store) return;
    const nextStatus = store.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setIsStatusSubmitting(true);
      const res = await adminStoreApi.toggleStatus(id, nextStatus);
      setStore((prev) => ({ ...prev, status: res.data.status }));
      setIsStatusModalOpen(false);
    } catch (err) {
      alert(err.message || 'Thay đổi trạng thái thất bại.');
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    try {
      setIsRegenSubmitting(true);
      const res = await adminStoreApi.regenerateInviteCode(id);
      const newCode = res.data.invite_code;
      setStore((prev) => ({ ...prev, invite_code: newCode }));
      setRegenSuccessCode(newCode);
    } catch (err) {
      alert(err.message || 'Không thể đặt lại mã mời.');
    } finally {
      setIsRegenSubmitting(false);
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    const identifier = addMemberForm.identifier.trim();
    if (!identifier) {
      setAddMemberError('Vui lòng nhập Email hoặc Tên đăng nhập của tài khoản.');
      return;
    }

    try {
      setIsAddMemberSubmitting(true);
      setAddMemberError('');
      const payload = identifier.includes('@')
        ? { email: identifier, role: addMemberForm.role }
        : { username: identifier, role: addMemberForm.role };

      await adminStoreApi.addMember(id, payload);
      await fetchStore();
      setIsAddMemberModalOpen(false);
      setAddMemberForm({ identifier: '', role: 'STAFF' });
    } catch (err) {
      setAddMemberError(err.message || 'Không thể thêm thành viên vào cửa hàng.');
    } finally {
      setIsAddMemberSubmitting(false);
    }
  };

  const handleChangeRoleSubmit = async () => {
    if (!selectedMember) return;
    try {
      setIsChangeRoleSubmitting(true);
      await adminStoreApi.updateMemberRole(id, selectedMember.id, newRole);
      await fetchStore();
      setIsChangeRoleModalOpen(false);
      setSelectedMember(null);
    } catch (err) {
      alert(err.message || 'Cập nhật vai trò thất bại.');
    } finally {
      setIsChangeRoleSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    try {
      setIsRemoveMemberSubmitting(true);
      await adminStoreApi.removeMember(id, selectedMember.id);
      await fetchStore();
      setIsRemoveMemberModalOpen(false);
      setSelectedMember(null);
    } catch (err) {
      alert(err.message || 'Gỡ thành viên thất bại.');
    } finally {
      setIsRemoveMemberSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader message="Đang tải dữ liệu cửa hàng..." />;
  }

  if (error || !store) {
    return (
      <div className="store-detail-page">
        <div className="store-breadcrumb">
          <Link to={ADMIN_ROUTES.TENANTS} className="store-breadcrumb-link">
            <ArrowLeft size={16} /> Quay lại danh sách tổ chức
          </Link>
        </div>
        <div className="store-alert-error" style={{ marginTop: '24px' }}>
          <AlertCircle size={20} />
          <span>{error || 'Không tìm thấy thông tin cửa hàng.'}</span>
        </div>
      </div>
    );
  }

  // Filtered members
  const staffList = store.staff || [];
  const filteredMembers = staffList.filter((m) => {
    const matchesSearch =
      (m.full_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.username || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(memberSearch.toLowerCase());

    const matchesRole =
      roleFilter === 'ALL' || m.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const storeInitials = store.name
    ? store.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ST';

  return (
    <div className="store-detail-page">
      {/* --- Breadcrumb --- */}
      <div className="store-breadcrumb">
        <Link
          to={store.tenant_id ? `/admin/tenants/${store.tenant_id}` : ADMIN_ROUTES.TENANTS}
          className="store-breadcrumb-link"
        >
          <ArrowLeft size={16} /> {store.tenant_name ? store.tenant_name : 'Danh sách tổ chức'}
        </Link>
      </div>

      {/* --- Store Header Block --- */}
      <div className="store-header-card">
        <div className="store-header-content">
          <div className="store-header-left">
            <div className="store-monogram-badge">{storeInitials}</div>
            <div className="store-header-meta">
              <div className="store-title-row">
                <h1 className="store-main-title">{store.name}</h1>
                <span className={`store-status-pill ${store.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                  <span className="store-status-dot" />
                  {store.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}
                </span>
              </div>
              <div className="store-subline">
                <span className="store-id-pill">
                  ID: {store.id.slice(0, 8)}...
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="store-copy-btn"
                    title="Sao chép toàn bộ ID"
                  >
                    {copiedId ? <Check size={13} color="#27672a" /> : <Copy size={13} />}
                  </button>
                </span>
                <span className="store-subline-divider">•</span>
                <span>
                  Thuộc{' '}
                  <Link
                    to={`/admin/tenants/${store.tenant_id}`}
                    className="store-tenant-link"
                  >
                    {store.tenant_name || 'Tổ chức'}
                  </Link>
                </span>
                <span className="store-subline-divider">•</span>
                <span>
                  Tạo ngày{' '}
                  {store.created_at
                    ? new Date(store.created_at).toLocaleDateString('vi-VN')
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="store-header-actions" ref={headerMenuRef}>
            <button
              type="button"
              className={`store-actions-menu-btn ${isHeaderMenuOpen ? 'active' : ''}`}
              onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
              aria-label="Tùy chọn cửa hàng"
            >
              <MoreHorizontal size={20} />
            </button>

            {isHeaderMenuOpen && (
              <div className="store-dropdown-menu">
                <button
                  type="button"
                  className="store-dropdown-item"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setEditForm({ name: store.name, address: store.address || '' });
                    setEditError('');
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa thông tin</span>
                </button>

                <button
                  type="button"
                  className="store-dropdown-item"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setRegenSuccessCode('');
                    setIsRegenModalOpen(true);
                  }}
                >
                  <KeyRound size={16} />
                  <span>Đặt lại mã mời</span>
                </button>

                <div className="store-dropdown-divider" />

                <button
                  type="button"
                  className={`store-dropdown-item ${store.status === 'ACTIVE' ? 'danger' : ''}`}
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setIsStatusModalOpen(true);
                  }}
                >
                  {store.status === 'ACTIVE' ? (
                    <>
                      <Ban size={16} />
                      <span>Vô hiệu hóa cửa hàng</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Kích hoạt lại cửa hàng</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Tabs Navigation --- */}
      <div className="store-tabs-bar">
        <button
          type="button"
          className={`store-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <StoreIcon size={16} />
          <span>Tổng quan</span>
        </button>
        <button
          type="button"
          className={`store-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={16} />
          <span>Thành viên</span>
          <span className="store-tab-count">{staffList.length}</span>
        </button>
      </div>

      {/* --- Tab 1: Overview --- */}
      {activeTab === 'overview' && (
        <div className="store-overview-grid">
          {/* Card 1: Thông tin cửa hàng */}
          <div className="store-card">
            <div className="store-card-header">
              <div className="store-card-title-group">
                <div className="store-card-icon">
                  <StoreIcon size={18} />
                </div>
                <h3 className="store-card-title">Thông tin cửa hàng</h3>
              </div>
              <button
                type="button"
                className="store-card-action-btn"
                onClick={() => {
                  setEditForm({ name: store.name, address: store.address || '' });
                  setEditError('');
                  setIsEditModalOpen(true);
                }}
              >
                <Edit size={14} /> Chỉnh sửa
              </button>
            </div>

            <div className="store-info-list">
              <div className="store-info-item">
                <span className="store-info-label">Mã cửa hàng (UUID)</span>
                <span className="store-info-value" style={{ fontFamily: 'monospace' }}>
                  {store.id}
                </span>
              </div>
              <div className="store-info-item">
                <span className="store-info-label">Tên cửa hàng</span>
                <span className="store-info-value">{store.name}</span>
              </div>
              <div className="store-info-item">
                <span className="store-info-label">Tổ chức trực thuộc</span>
                <span className="store-info-value">
                  <Link to={`/admin/tenants/${store.tenant_id}`} className="store-tenant-link">
                    {store.tenant_name} ({store.tenant_slug})
                  </Link>
                </span>
              </div>
              <div className="store-info-item">
                <span className="store-info-label">Địa chỉ</span>
                <span className="store-info-value">{store.address || 'Chưa cập nhật địa chỉ'}</span>
              </div>
              <div className="store-info-item">
                <span className="store-info-label">Trạng thái</span>
                <span className="store-info-value">
                  <span className={`store-status-pill ${store.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                    <span className="store-status-dot" />
                    {store.status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </span>
              </div>
              <div className="store-info-item">
                <span className="store-info-label">Ngày khởi tạo</span>
                <span className="store-info-value">
                  {store.created_at
                    ? new Date(store.created_at).toLocaleString('vi-VN')
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Quyền truy cập & Nhân sự */}
          <div className="store-card">
            <div className="store-card-header">
              <div className="store-card-title-group">
                <div className="store-card-icon">
                  <ShieldCheck size={18} />
                </div>
                <h3 className="store-card-title">Truy cập & Nhân sự</h3>
              </div>
              <button
                type="button"
                className="store-card-action-btn"
                onClick={() => {
                  setRegenSuccessCode('');
                  setIsRegenModalOpen(true);
                }}
              >
                <KeyRound size={14} /> Quản lý mã mời
              </button>
            </div>

            <div className="store-metrics-list">
              <div
                className="store-metric-box clickable"
                onClick={() => setActiveTab('members')}
                title="Nhấn để xem danh sách nhân sự"
              >
                <div className="store-metric-left">
                  <span className="store-metric-title">Tổng nhân sự cửa hàng</span>
                  <span className="store-metric-detail">Bao gồm Quản lý & Nhân viên</span>
                </div>
                <div className="store-metric-val">{store.stats?.total_staff || 0} thành viên</div>
              </div>

              <div className="store-metric-box">
                <div className="store-metric-left">
                  <span className="store-metric-title">Phân bổ vai trò</span>
                  <span className="store-metric-detail">Cơ cấu nhân sự tại điểm bán</span>
                </div>
                <div className="store-metric-val" style={{ fontSize: '14px', textAlign: 'right' }}>
                  <div style={{ color: '#273b28', fontWeight: '700' }}>
                    {store.stats?.manager_count || 0} Quản lý (Manager)
                  </div>
                  <div style={{ color: '#637563', fontWeight: '500', fontSize: '13px' }}>
                    {store.stats?.staff_count || 0} Nhân viên (Staff)
                  </div>
                </div>
              </div>

              <div className="store-metric-box">
                <div className="store-metric-left">
                  <span className="store-metric-title">Mã mời nhân sự hiện tại</span>
                  <span className="store-metric-detail">Dùng để nhân viên tự gia nhập cửa hàng</span>
                </div>
                <div className="store-invite-preview">
                  <span className="store-invite-code-tag">{store.invite_code || 'CHƯA TẠO'}</span>
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    className="store-copy-btn"
                    title="Sao chép mã mời"
                  >
                    {copiedInviteCode ? (
                      <Check size={16} color="#27672a" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 2: Members --- */}
      {activeTab === 'members' && (
        <div className="store-members-wrapper">
          <div className="store-members-header">
            <div className="store-members-title-group">
              <h3 className="store-members-main-title">Danh sách nhân sự & Phân quyền</h3>
              <span className="store-members-subtitle">
                {staffList.length} thành viên đang được phân công vào cửa hàng này
              </span>
            </div>
            <button
              type="button"
              className="store-add-member-btn"
              onClick={() => {
                setAddMemberForm({ identifier: '', role: 'STAFF' });
                setAddMemberError('');
                setIsAddMemberModalOpen(true);
              }}
            >
              <UserPlus size={16} /> Thêm thành viên
            </button>
          </div>

          <div className="store-members-toolbar">
            <div className="store-search-box">
              <Search size={16} color="#718371" />
              <input
                type="text"
                className="store-search-input"
                placeholder="Tìm tên, username hoặc email..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>

            <div className="store-role-filters">
              <button
                type="button"
                className={`store-role-filter-pill ${roleFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setRoleFilter('ALL')}
              >
                Tất cả ({staffList.length})
              </button>
              <button
                type="button"
                className={`store-role-filter-pill ${roleFilter === 'MANAGER' ? 'active' : ''}`}
                onClick={() => setRoleFilter('MANAGER')}
              >
                Manager ({store.stats?.manager_count || 0})
              </button>
              <button
                type="button"
                className={`store-role-filter-pill ${roleFilter === 'STAFF' ? 'active' : ''}`}
                onClick={() => setRoleFilter('STAFF')}
              >
                Staff ({store.stats?.staff_count || 0})
              </button>
            </div>
          </div>

          <div className="store-table-container">
            <table className="store-table">
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tham gia</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="store-empty-table">
                        <Users size={36} className="store-empty-icon" />
                        <div>Không tìm thấy nhân sự phù hợp với bộ lọc.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const initials = member.full_name
                      ? member.full_name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : member.username.slice(0, 2).toUpperCase();

                    const isMenuOpen = activeMemberMenuId === member.id;

                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="store-user-cell">
                            <div className="store-user-avatar">{initials}</div>
                            <div className="store-user-meta">
                              <span className="store-user-name">
                                {member.full_name || member.username}
                              </span>
                              <span className="store-user-email">
                                {member.email || `@${member.username}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`store-role-badge ${
                              member.role === 'MANAGER' ? 'manager' : 'staff'
                            }`}
                          >
                            {member.role === 'MANAGER' ? 'Manager' : 'Staff'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`store-status-pill ${
                              member.user_status === 'ACTIVE' ? 'active' : 'inactive'
                            }`}
                          >
                            <span className="store-status-dot" />
                            {member.user_status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td>
                          {member.joined_at
                            ? new Date(member.joined_at).toLocaleDateString('vi-VN')
                            : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div
                            className="store-member-menu-container"
                            style={{ position: 'relative', display: 'inline-block' }}
                          >
                            <button
                              type="button"
                              className={`store-member-actions-btn ${isMenuOpen ? 'active' : ''}`}
                              onClick={() =>
                                setActiveMemberMenuId((prev) => (prev === member.id ? null : member.id))
                              }
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {isMenuOpen && (
                              <div
                                className="store-dropdown-menu"
                                style={{ right: 0, top: 'calc(100% + 4px)', width: '180px' }}
                              >
                                <button
                                  type="button"
                                  className="store-dropdown-item"
                                  onClick={() => {
                                    setActiveMemberMenuId(null);
                                    setSelectedMember(member);
                                    setNewRole(member.role === 'MANAGER' ? 'STAFF' : 'MANAGER');
                                    setIsChangeRoleModalOpen(true);
                                  }}
                                >
                                  <UserCheck size={15} />
                                  <span>Đổi vai trò</span>
                                </button>
                                <div className="store-dropdown-divider" />
                                <button
                                  type="button"
                                  className="store-dropdown-item danger"
                                  onClick={() => {
                                    setActiveMemberMenuId(null);
                                    setSelectedMember(member);
                                    setIsRemoveMemberModalOpen(true);
                                  }}
                                >
                                  <Trash2 size={15} />
                                  <span>Gỡ khỏi cửa hàng</span>
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
        </div>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* Modal 1: Edit Store */}
      {isEditModalOpen && (
        <div className="store-modal-overlay">
          <div className="store-modal-container">
            <div className="store-modal-header">
              <h3 className="store-modal-title">Chỉnh sửa thông tin cửa hàng</h3>
              <button
                type="button"
                className="store-modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="store-modal-body">
                {editError && (
                  <div className="store-alert-error">
                    <AlertCircle size={16} />
                    <span>{editError}</span>
                  </div>
                )}
                <div className="store-form-group">
                  <label className="store-form-label">Tên cửa hàng *</label>
                  <input
                    type="text"
                    className="store-form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="VD: Cửa hàng A - Quận 1"
                    required
                  />
                </div>
                <div className="store-form-group">
                  <label className="store-form-label">Địa chỉ</label>
                  <textarea
                    className="store-form-textarea"
                    rows={3}
                    value={editForm.address}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="VD: 123 Nguyễn Thị Minh Khai, P. Bến Nghé, Quận 1, TP.HCM"
                  />
                </div>
              </div>
              <div className="store-modal-footer">
                <button
                  type="button"
                  className="store-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isEditSubmitting}
                >
                  Hủy
                </button>
                <button type="submit" className="store-btn-primary" disabled={isEditSubmitting}>
                  {isEditSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Regenerate Invite Code */}
      {isRegenModalOpen && (
        <div className="store-modal-overlay">
          <div className="store-modal-container">
            <div className="store-modal-header">
              <h3 className="store-modal-title">Đặt lại mã mời nhân sự</h3>
              <button
                type="button"
                className="store-modal-close-btn"
                onClick={() => setIsRegenModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="store-modal-body">
              <div className="store-alert-warning">
                <AlertTriangle size={18} />
                <span>
                  Mã mời cũ sẽ bị vô hiệu hóa ngay lập tức. Các nhân sự mới sẽ cần mã mới này để gia nhập cửa hàng.
                </span>
              </div>

              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '13px', color: '#657765', marginBottom: '8px' }}>
                  {regenSuccessCode ? 'Mã mời mới đã được tạo thành công:' : 'Mã mời hiện tại:'}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#f0f4f0',
                    border: '1px solid #d3ded3',
                    padding: '8px 20px',
                    borderRadius: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '20px',
                      fontWeight: '800',
                      letterSpacing: '2px',
                      color: '#273b28',
                    }}
                  >
                    {regenSuccessCode || store.invite_code || 'CHƯA CÓ'}
                  </span>
                </div>
              </div>
            </div>
            <div className="store-modal-footer">
              <button
                type="button"
                className="store-btn-secondary"
                onClick={() => setIsRegenModalOpen(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="store-btn-primary"
                onClick={handleRegenerateInviteCode}
                disabled={isRegenSubmitting}
              >
                {isRegenSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <RefreshCw size={15} /> Tạo mã mới
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Add Member */}
      {isAddMemberModalOpen && (
        <div className="store-modal-overlay">
          <div className="store-modal-container">
            <div className="store-modal-header">
              <h3 className="store-modal-title">Thêm nhân sự vào cửa hàng</h3>
              <button
                type="button"
                className="store-modal-close-btn"
                onClick={() => setIsAddMemberModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMemberSubmit}>
              <div className="store-modal-body">
                {addMemberError && (
                  <div className="store-alert-error">
                    <AlertCircle size={16} />
                    <span>{addMemberError}</span>
                  </div>
                )}
                <div className="store-form-group">
                  <label className="store-form-label">Email hoặc Tên đăng nhập *</label>
                  <input
                    type="text"
                    className="store-form-input"
                    placeholder="VD: staff1@coffee.com hoặc staff1"
                    value={addMemberForm.identifier}
                    onChange={(e) =>
                      setAddMemberForm((prev) => ({ ...prev, identifier: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="store-form-group">
                  <label className="store-form-label">Vai trò tại cửa hàng *</label>
                  <select
                    className="store-form-select"
                    value={addMemberForm.role}
                    onChange={(e) =>
                      setAddMemberForm((prev) => ({ ...prev, role: e.target.value }))
                    }
                  >
                    <option value="STAFF">Staff (Nhân viên)</option>
                    <option value="MANAGER">Manager (Quản lý cửa hàng)</option>
                  </select>
                </div>
              </div>
              <div className="store-modal-footer">
                <button
                  type="button"
                  className="store-btn-secondary"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  disabled={isAddMemberSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="store-btn-primary"
                  disabled={isAddMemberSubmitting}
                >
                  {isAddMemberSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Thêm vào cửa hàng'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Change Role */}
      {isChangeRoleModalOpen && selectedMember && (
        <div className="store-modal-overlay">
          <div className="store-modal-container">
            <div className="store-modal-header">
              <h3 className="store-modal-title">Thay đổi vai trò nhân sự</h3>
              <button
                type="button"
                className="store-modal-close-btn"
                onClick={() => setIsChangeRoleModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="store-modal-body">
              <p style={{ margin: 0, fontSize: '14px', color: '#384938' }}>
                Thay đổi vai trò cho thành viên{' '}
                <strong>{selectedMember.full_name || selectedMember.username}</strong> ({selectedMember.email}):
              </p>
              <div className="store-form-group">
                <label className="store-form-label">Chọn vai trò mới</label>
                <select
                  className="store-form-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="MANAGER">Manager (Quản lý cửa hàng)</option>
                  <option value="STAFF">Staff (Nhân viên)</option>
                </select>
              </div>
            </div>
            <div className="store-modal-footer">
              <button
                type="button"
                className="store-btn-secondary"
                onClick={() => setIsChangeRoleModalOpen(false)}
                disabled={isChangeRoleSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="store-btn-primary"
                onClick={handleChangeRoleSubmit}
                disabled={isChangeRoleSubmitting}
              >
                {isChangeRoleSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Cập nhật vai trò'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Remove Member */}
      {isRemoveMemberModalOpen && selectedMember && (
        <div className="store-modal-overlay">
          <div className="store-modal-container">
            <div className="store-modal-header">
              <h3 className="store-modal-title">Xác nhận gỡ thành viên</h3>
              <button
                type="button"
                className="store-modal-close-btn"
                onClick={() => setIsRemoveMemberModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="store-modal-body">
              <div className="store-alert-error">
                <AlertTriangle size={18} />
                <span>
                  Bạn có chắc chắn muốn gỡ <strong>{selectedMember.full_name || selectedMember.username}</strong> khỏi cửa hàng này? Nhân viên sẽ mất quyền truy cập vào POS & quản lý của cửa hàng.
                </span>
              </div>
            </div>
            <div className="store-modal-footer">
              <button
                type="button"
                className="store-btn-secondary"
                onClick={() => setIsRemoveMemberModalOpen(false)}
                disabled={isRemoveMemberSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="store-btn-danger"
                onClick={handleRemoveMember}
                disabled={isRemoveMemberSubmitting}
              >
                {isRemoveMemberSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Xác nhận gỡ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Deactivate / Activate Store */}
      {isStatusModalOpen && (
        <div className="store-modal-overlay">
          <div className="store-modal-container">
            <div className="store-modal-header">
              <h3 className="store-modal-title">
                {store.status === 'ACTIVE'
                  ? 'Vô hiệu hóa cửa hàng'
                  : 'Kích hoạt lại cửa hàng'}
              </h3>
              <button
                type="button"
                className="store-modal-close-btn"
                onClick={() => setIsStatusModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="store-modal-body">
              {store.status === 'ACTIVE' ? (
                <div className="store-alert-warning">
                  <AlertTriangle size={18} />
                  <span>
                    Khi vô hiệu hóa, nhân viên tại cửa hàng sẽ không thể đăng nhập hoặc thực hiện giao dịch POS cho đến khi được kích hoạt lại.
                  </span>
                </div>
              ) : (
                <div className="store-alert-warning" style={{ background: '#f0f9f0', borderColor: '#d1e7d1', color: '#27672a' }}>
                  <CheckCircle2 size={18} />
                  <span>
                    Cửa hàng sẽ được khôi phục hoạt động và nhân sự có thể tiếp tục sử dụng hệ thống bình thường.
                  </span>
                </div>
              )}
            </div>
            <div className="store-modal-footer">
              <button
                type="button"
                className="store-btn-secondary"
                onClick={() => setIsStatusModalOpen(false)}
                disabled={isStatusSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className={store.status === 'ACTIVE' ? 'store-btn-danger' : 'store-btn-primary'}
                onClick={handleToggleStatus}
                disabled={isStatusSubmitting}
              >
                {isStatusSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : store.status === 'ACTIVE' ? (
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
