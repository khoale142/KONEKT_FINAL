import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  MoreVertical,
  Shield,
  Eye,
  Sliders,
  KeyRound,
  UserX,
  CheckCircle2,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  History,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { adminInternalStaffApi } from '../api/adminInternalStaffApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import './InternalStaffPage.css';

const ROLE_DESCRIPTIONS = {
  SUPER_ADMIN: 'SUPER_ADMIN: Toàn quyền quản trị hệ thống và kiểm soát bảo mật cao nhất.',
  ADMIN: 'ADMIN: Quản lý tổ chức, cửa hàng, tài khoản người dùng và vận hành.',
  SUPPORT: 'SUPPORT: Tra cứu dữ liệu, xem báo cáo và hỗ trợ người dùng với quyền hạn giới hạn.',
};

export function InternalStaffPage() {
  const [staffList, setStaffList] = useState([]);
  const [counts, setCounts] = useState({ all_count: 0, active_count: 0, inactive_count: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  // Active Dropdown Menu
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Drawer State
  const [selectedStaffForDrawer, setSelectedStaffForDrawer] = useState(null);
  const [drawerSelectedRole, setDrawerSelectedRole] = useState('ADMIN');
  const [isDrawerSavingRole, setIsDrawerSavingRole] = useState(false);

  // Modal States
  // 1. Add Staff Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'ADMIN',
  });
  const [isAddSubmitting, setIsAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  // 2. Change Role Modal
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [targetStaffForRole, setTargetStaffForRole] = useState(null);
  const [newRoleForModal, setNewRoleForModal] = useState('ADMIN');
  const [isChangeRoleSubmitting, setIsChangeRoleSubmitting] = useState(false);

  // 3. Deactivate / Activate Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStaffForStatus, setTargetStaffForStatus] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  // 4. Reset Password Modal
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState(false);
  const [targetStaffForPwd, setTargetStaffForPwd] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetPwdSubmitting, setIsResetPwdSubmitting] = useState(false);
  const [resetPwdError, setResetPwdError] = useState('');

  const fetchStaffList = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminInternalStaffApi.getStaffList({
        search,
        status: activeTab,
        role,
        sort,
        page,
        limit: 10,
      });

      const list = res.data.staff || [];
      setStaffList(list);
      setCounts(res.data.counts || { all_count: 0, active_count: 0, inactive_count: 0 });
      setPagination(res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });

      // If drawer is open, keep selected staff updated
      if (selectedStaffForDrawer) {
        const updated = list.find((s) => s.id === selectedStaffForDrawer.id);
        if (updated) {
          setSelectedStaffForDrawer(updated);
          setDrawerSelectedRole(updated.role);
        }
      }
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách nhân sự nội bộ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
  }, [activeTab, role, sort, page]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchStaffList();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest('.staff-menu-wrap')) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Chưa đăng nhập';
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    return `${diffDays} ngày trước`;
  };

  // Open Drawer Handler
  const handleOpenDrawer = (staff) => {
    setSelectedStaffForDrawer(staff);
    setDrawerSelectedRole(staff.role);
  };

  const handleCloseDrawer = () => {
    setSelectedStaffForDrawer(null);
  };

  // Save Role from Drawer
  const handleSaveRoleFromDrawer = async () => {
    if (!selectedStaffForDrawer) return;
    if (drawerSelectedRole === selectedStaffForDrawer.role) {
      handleCloseDrawer();
      return;
    }

    try {
      setIsDrawerSavingRole(true);
      await adminInternalStaffApi.updateRole(selectedStaffForDrawer.id, drawerSelectedRole);
      await fetchStaffList();
      alert('Đã cập nhật vai trò nhân sự thành công.');
    } catch (err) {
      alert(err.message || 'Cập nhật vai trò thất bại.');
    } finally {
      setIsDrawerSavingRole(false);
    }
  };

  // Add Staff Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.email.trim()) {
      setAddError('Vui lòng điền đầy đủ Email và Tên đăng nhập.');
      return;
    }

    try {
      setIsAddSubmitting(true);
      setAddError('');
      await adminInternalStaffApi.addStaff(addForm);
      setIsAddModalOpen(false);
      setAddForm({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'ADMIN',
      });
      fetchStaffList();
    } catch (err) {
      setAddError(err.message || 'Thêm nhân sự nội bộ thất bại.');
    } finally {
      setIsAddSubmitting(false);
    }
  };

  // Change Role Submit
  const handleChangeRoleSubmit = async () => {
    if (!targetStaffForRole) return;
    try {
      setIsChangeRoleSubmitting(true);
      await adminInternalStaffApi.updateRole(targetStaffForRole.id, newRoleForModal);
      setIsChangeRoleModalOpen(false);
      setTargetStaffForRole(null);
      fetchStaffList();
    } catch (err) {
      alert(err.message || 'Đổi vai trò thất bại.');
    } finally {
      setIsChangeRoleSubmitting(false);
    }
  };

  // Toggle Status Submit
  const handleToggleStatusSubmit = async () => {
    if (!targetStaffForStatus) return;
    const nextStatus = targetStaffForStatus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (nextStatus === 'INACTIVE' && !statusReason.trim()) {
      alert('Vui lòng nhập lý do vô hiệu hóa.');
      return;
    }

    try {
      setIsStatusSubmitting(true);
      await adminInternalStaffApi.toggleStatus(targetStaffForStatus.id, nextStatus, statusReason);
      setIsStatusModalOpen(false);
      setTargetStaffForStatus(null);
      setStatusReason('');
      fetchStaffList();
    } catch (err) {
      alert(err.message || 'Thay đổi trạng thái thất bại.');
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  // Reset Password Submit
  const handleResetPwdSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setResetPwdError('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }

    try {
      setIsResetPwdSubmitting(true);
      setResetPwdError('');
      await adminInternalStaffApi.resetPassword(targetStaffForPwd.id, newPassword);
      setIsResetPwdModalOpen(false);
      setTargetStaffForPwd(null);
      setNewPassword('');
      alert('Đặt lại mật khẩu thành công.');
    } catch (err) {
      setResetPwdError(err.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsResetPwdSubmitting(false);
    }
  };

  return (
    <div className="staff-page">
      {/* --- A. HEADER SECTION --- */}
      <div className="staff-header-row">
        <div className="staff-title-group">
          <h1 className="staff-main-title">Nhân sự nội bộ</h1>
          <p className="staff-subtitle">Quản lý các tài khoản quản trị nội bộ của KONEKT.</p>
        </div>

        <button
          type="button"
          className="staff-add-btn"
          onClick={() => {
            setAddError('');
            setAddForm({
              username: '',
              email: '',
              full_name: '',
              password: '',
              role: 'ADMIN',
            });
            setIsAddModalOpen(true);
          }}
        >
          <Plus size={18} />
          <span>Thêm nhân sự</span>
        </button>
      </div>

      {/* --- B. STATUS TABS --- */}
      <div className="staff-tabs-bar">
        <button
          type="button"
          className={`staff-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ALL');
            setPage(1);
          }}
        >
          <span>Tất cả</span>
          <span className="staff-tab-badge">{counts.all_count || 0}</span>
        </button>

        <button
          type="button"
          className={`staff-tab-btn ${activeTab === 'ACTIVE' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ACTIVE');
            setPage(1);
          }}
        >
          <span>Hoạt động</span>
          <span className="staff-tab-badge">{counts.active_count || 0}</span>
        </button>

        <button
          type="button"
          className={`staff-tab-btn ${activeTab === 'INACTIVE' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('INACTIVE');
            setPage(1);
          }}
        >
          <span>Ngừng hoạt động</span>
          <span className="staff-tab-badge">{counts.inactive_count || 0}</span>
        </button>
      </div>

      {/* --- C. TOOLBAR --- */}
      <div className="staff-toolbar">
        <div className="staff-search-wrap">
          <Search size={18} className="staff-search-icon" />
          <input
            type="text"
            className="staff-search-input"
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="staff-filters-right">
          <select
            className="staff-select"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Vai trò: Tất cả</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPPORT">SUPPORT</option>
          </select>

          <select
            className="staff-select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="name_asc">Tên A-Z</option>
            <option value="name_desc">Tên Z-A</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="staff-alert-error" style={{ marginBottom: '16px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* --- D. BẢNG DANH SÁCH NHÂN SỰ (Chuẩn 5 cột) --- */}
      <div className="staff-table-card">
        <div className="staff-table-container">
          <table className="staff-table">
            <thead>
              <tr>
                <th>NHÂN SỰ</th>
                <th>VAI TRÒ</th>
                <th>TRẠNG THÁI</th>
                <th>ĐĂNG NHẬP</th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '13.5px', color: '#5c6e61' }}>
                        Đang tải danh sách nhân sự nội bộ...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div style={{ padding: '48px', textAlign: 'center', color: '#5c6e61' }}>
                      <Shield size={36} style={{ margin: '0 auto 10px', color: '#a3bfa8' }} />
                      <div style={{ fontWeight: '600', color: '#1f2e24' }}>
                        Không tìm thấy nhân sự nội bộ nào
                      </div>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc vai trò.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                staffList.map((staff, idx) => {
                  const isDrawerActive = selectedStaffForDrawer?.id === staff.id;
                  const isMenuOpen = activeMenuId === staff.id;
                  const isInactive = staff.status !== 'ACTIVE';
                  const initial = (staff.full_name || staff.username || 'A')
                    .charAt(0)
                    .toUpperCase();
                  const staffCode = `SA-${staff.id.slice(0, 5).toUpperCase()}`;

                  return (
                    <tr
                      key={staff.id}
                      className={`staff-clickable-row ${isDrawerActive ? 'selected-row' : ''} ${
                        isInactive ? 'inactive-row' : ''
                      }`}
                      onClick={() => handleOpenDrawer(staff)}
                    >
                      <td>
                        <div className="staff-user-cell">
                          <div className={`staff-avatar ${idx % 2 === 1 ? 'secondary' : ''}`}>
                            {initial}
                          </div>
                          <div className="staff-user-meta">
                            <span className="staff-user-name">
                              {staff.full_name || staff.username}
                            </span>
                            <span className="staff-user-email">{staff.email}</span>
                            <span className="staff-user-code">{staffCode}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`staff-role-badge ${staff.role?.toLowerCase().replace('_', '-')}`}
                        >
                          {staff.role}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`staff-status-indicator ${
                            staff.status === 'ACTIVE' ? 'active' : 'inactive'
                          }`}
                        >
                          <span className="staff-status-dot" />
                          <span>{staff.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}</span>
                        </span>
                      </td>

                      <td className="staff-time-cell">
                        {formatRelativeTime(staff.last_login_at)}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div
                          className="staff-menu-wrap"
                          style={{ position: 'relative', display: 'inline-block' }}
                        >
                          <button
                            type="button"
                            className={`staff-action-btn ${isMenuOpen ? 'active' : ''}`}
                            onClick={() =>
                              setActiveMenuId((prev) => (prev === staff.id ? null : staff.id))
                            }
                            title="Tùy chọn"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {isMenuOpen && (
                            <div className="staff-menu-dropdown">
                              <button
                                type="button"
                                className="staff-menu-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleOpenDrawer(staff);
                                }}
                              >
                                <Eye size={15} color="#5c6e61" />
                                <span>Xem chi tiết</span>
                              </button>

                              <button
                                type="button"
                                className="staff-menu-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setTargetStaffForRole(staff);
                                  setNewRoleForModal(
                                    staff.role === 'ADMIN'
                                      ? 'SUPPORT'
                                      : staff.role === 'SUPER_ADMIN'
                                      ? 'ADMIN'
                                      : 'ADMIN'
                                  );
                                  setIsChangeRoleModalOpen(true);
                                }}
                              >
                                <Sliders size={15} color="#5c6e61" />
                                <span>Đổi vai trò</span>
                              </button>

                              <button
                                type="button"
                                className="staff-menu-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setTargetStaffForPwd(staff);
                                  setNewPassword('');
                                  setResetPwdError('');
                                  setIsResetPwdModalOpen(true);
                                }}
                              >
                                <KeyRound size={15} color="#5c6e61" />
                                <span>Đặt lại mật khẩu</span>
                              </button>

                              <div className="staff-menu-divider" />

                              <button
                                type="button"
                                className={`staff-menu-item ${
                                  staff.status === 'ACTIVE' ? 'danger' : ''
                                }`}
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setTargetStaffForStatus(staff);
                                  setStatusReason('');
                                  setIsStatusModalOpen(true);
                                }}
                              >
                                {staff.status === 'ACTIVE' ? (
                                  <>
                                    <UserX size={15} color="#ba1a1a" />
                                    <span>Vô hiệu hóa</span>
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
      </div>

      {/* =========================================================================
          E. SLIDE-OVER STAFF DETAIL DRAWER (460px)
         ========================================================================= */}
      {selectedStaffForDrawer && (
        <>
          <div className="staff-drawer-backdrop" onClick={handleCloseDrawer} />
          <aside className="staff-drawer">
            {/* Drawer Header */}
            <div className="staff-drawer-header">
              <div className="staff-drawer-top-row">
                <h2 className="staff-drawer-title">Chi tiết nhân sự</h2>
                <button
                  type="button"
                  className="staff-drawer-close-btn"
                  onClick={handleCloseDrawer}
                  title="Đóng bảng"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Profile Block */}
              <div className="staff-drawer-profile-box">
                <div className="staff-drawer-avatar">
                  {(selectedStaffForDrawer.full_name || selectedStaffForDrawer.username || 'A')
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="staff-drawer-profile-info">
                  <div className="staff-drawer-name-row">
                    <span className="staff-drawer-name">
                      {selectedStaffForDrawer.full_name || selectedStaffForDrawer.username}
                    </span>
                    <span
                      className={`staff-role-badge ${selectedStaffForDrawer.role
                        ?.toLowerCase()
                        .replace('_', '-')}`}
                    >
                      {selectedStaffForDrawer.role}
                    </span>
                  </div>
                  <span className="staff-drawer-email">{selectedStaffForDrawer.email}</span>
                </div>

                <div
                  className={`staff-status-indicator ${
                    selectedStaffForDrawer.status === 'ACTIVE' ? 'active' : 'inactive'
                  }`}
                  style={{
                    background:
                      selectedStaffForDrawer.status === 'ACTIVE' ? '#edf3ea' : '#ffdad6',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11.5px',
                  }}
                >
                  <span className="staff-status-dot" />
                  <span>
                    {selectedStaffForDrawer.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="staff-drawer-body">
              {/* Section 1: Thông tin chung */}
              <div>
                <h3 className="staff-drawer-section-title">Thông tin chung</h3>
                <div className="staff-drawer-grid">
                  <div className="staff-drawer-info-tile">
                    <span className="staff-drawer-tile-label">Staff ID</span>
                    <span className="staff-drawer-tile-val" style={{ fontFamily: 'monospace' }}>
                      {`SA-${selectedStaffForDrawer.id.slice(0, 5).toUpperCase()}`}
                    </span>
                  </div>

                  <div className="staff-drawer-info-tile">
                    <span className="staff-drawer-tile-label">Ngày tạo</span>
                    <span className="staff-drawer-tile-val">
                      {selectedStaffForDrawer.created_at
                        ? new Date(selectedStaffForDrawer.created_at).toLocaleDateString('vi-VN')
                        : '—'}
                    </span>
                  </div>

                  <div className="staff-drawer-info-tile">
                    <span className="staff-drawer-tile-label">Đăng nhập cuối</span>
                    <span className="staff-drawer-tile-val">
                      {formatRelativeTime(selectedStaffForDrawer.last_login_at)}
                    </span>
                  </div>

                  <div className="staff-drawer-info-tile">
                    <span className="staff-drawer-tile-label">Trạng thái</span>
                    <span
                      className={`staff-status-indicator ${
                        selectedStaffForDrawer.status === 'ACTIVE' ? 'active' : 'inactive'
                      }`}
                      style={{ marginTop: '2px' }}
                    >
                      <span className="staff-status-dot" />
                      <span>
                        {selectedStaffForDrawer.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Vai trò hiện tại */}
              <div>
                <label className="staff-drawer-section-title" style={{ display: 'block' }}>
                  Vai trò hiện tại
                </label>
                <select
                  className="staff-form-select"
                  style={{ width: '100%', cursor: 'pointer' }}
                  value={drawerSelectedRole}
                  onChange={(e) => setDrawerSelectedRole(e.target.value)}
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPPORT">SUPPORT</option>
                </select>

                {/* Role Description */}
                <p className="staff-role-desc-box">
                  {ROLE_DESCRIPTIONS[drawerSelectedRole] || ROLE_DESCRIPTIONS.ADMIN}
                </p>
              </div>

              {/* Section 3: Audit Log Link */}
              <div>
                <Link
                  to={`${ADMIN_ROUTES.AUDIT}?actorId=${selectedStaffForDrawer.id}`}
                  className="staff-audit-link-card"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={18} color="#3c5642" />
                    <span>Xem nhật ký kiểm toán</span>
                  </span>
                  <ArrowRight size={16} color="#5c6e61" />
                </Link>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="staff-drawer-footer">
              <div className="staff-drawer-footer-actions-sub">
                <button
                  type="button"
                  className="staff-btn-cancel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                  }}
                  onClick={() => {
                    setTargetStaffForPwd(selectedStaffForDrawer);
                    setNewPassword('');
                    setResetPwdError('');
                    setIsResetPwdModalOpen(true);
                  }}
                >
                  <KeyRound size={15} color="#5c6e61" />
                  <span>Đặt lại mật khẩu</span>
                </button>

                <button
                  type="button"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background:
                      selectedStaffForDrawer.status === 'ACTIVE' ? '#fdf2f2' : '#edf5ee',
                    color: selectedStaffForDrawer.status === 'ACTIVE' ? '#dc2626' : '#253f2c',
                    border: `1px solid ${
                      selectedStaffForDrawer.status === 'ACTIVE' ? '#fecaca' : '#ccdac8'
                    }`,
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onClick={() => {
                    setTargetStaffForStatus(selectedStaffForDrawer);
                    setStatusReason('');
                    setIsStatusModalOpen(true);
                  }}
                >
                  {selectedStaffForDrawer.status === 'ACTIVE' ? (
                    <>
                      <UserX size={15} />
                      <span>Vô hiệu hóa</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Kích hoạt lại</span>
                    </>
                  )}
                </button>
              </div>

              <div className="staff-drawer-footer-actions-main">
                <button
                  type="button"
                  className="staff-btn-cancel"
                  onClick={handleCloseDrawer}
                  disabled={isDrawerSavingRole}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="staff-btn-submit"
                  onClick={handleSaveRoleFromDrawer}
                  disabled={isDrawerSavingRole}
                >
                  {isDrawerSavingRole ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* =========================================================================
          F. MODALS
         ========================================================================= */}

      {/* Modal 1: Thêm nhân sự nội bộ */}
      {isAddModalOpen && (
        <div className="staff-modal-overlay">
          <div className="staff-modal-container">
            <div className="staff-modal-header">
              <h3 className="staff-modal-title">Thêm nhân sự nội bộ</h3>
              <button
                type="button"
                className="staff-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="staff-modal-body">
                {addError && (
                  <div className="staff-alert-error">
                    <AlertCircle size={16} />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="staff-form-group">
                  <label className="staff-form-label">Email tài khoản *</label>
                  <input
                    type="email"
                    className="staff-form-input"
                    placeholder="VD: staff@konekt.vn"
                    value={addForm.email}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-form-label">Tên đăng nhập (Username) *</label>
                  <input
                    type="text"
                    className="staff-form-input"
                    placeholder="VD: john_konekt"
                    value={addForm.username}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-form-label">Họ và tên</label>
                  <input
                    type="text"
                    className="staff-form-input"
                    placeholder="VD: Johnathan Doe"
                    value={addForm.full_name}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-form-label">Mật khẩu khởi tạo</label>
                  <input
                    type="password"
                    className="staff-form-input"
                    placeholder="Mặc định: 123456 nếu để trống"
                    value={addForm.password}
                    onChange={(e) =>
                      setAddForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-form-label">Vai trò quản trị *</label>
                  <select
                    className="staff-form-select"
                    value={addForm.role}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                    required
                  >
                    <option value="SUPPORT">SUPPORT — Tra cứu và hỗ trợ hạn chế</option>
                    <option value="ADMIN">ADMIN — Quản lý tenant, account và store</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN — Toàn quyền quản trị hệ thống</option>
                  </select>
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-btn-cancel"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isAddSubmitting}
                >
                  Hủy
                </button>
                <button type="submit" className="staff-btn-submit" disabled={isAddSubmitting}>
                  {isAddSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Thêm nhân sự'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Xác nhận Thay đổi vai trò */}
      {isChangeRoleModalOpen && targetStaffForRole && (
        <div className="staff-modal-overlay">
          <div className="staff-modal-container" style={{ maxWidth: '400px' }}>
            <div className="staff-modal-body" style={{ padding: '24px', textAlign: 'left' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <Sliders size={20} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700' }}>
                Thay đổi vai trò?
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#5c6e61' }}>
                Xác nhận đổi vai trò cho{' '}
                <strong>{targetStaffForRole.full_name || targetStaffForRole.username}</strong>:{' '}
                <span style={{ color: '#1f2e24', fontWeight: '600' }}>
                  {targetStaffForRole.role}
                </span>{' '}
                →{' '}
                <span style={{ color: '#3c5642', fontWeight: '700' }}>{newRoleForModal}</span>.
              </p>

              <div className="staff-form-group">
                <label className="staff-form-label">Chọn vai trò mới</label>
                <select
                  className="staff-form-select"
                  value={newRoleForModal}
                  onChange={(e) => setNewRoleForModal(e.target.value)}
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPPORT">SUPPORT</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '20px',
                }}
              >
                <button
                  type="button"
                  className="staff-btn-cancel"
                  onClick={() => setIsChangeRoleModalOpen(false)}
                  disabled={isChangeRoleSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="staff-btn-submit"
                  onClick={handleChangeRoleSubmit}
                  disabled={isChangeRoleSubmitting}
                >
                  {isChangeRoleSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Xác nhận'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Xác nhận Vô hiệu hóa / Kích hoạt lại */}
      {isStatusModalOpen && targetStaffForStatus && (
        <div className="staff-modal-overlay">
          <div className="staff-modal-container" style={{ maxWidth: '400px' }}>
            <div className="staff-modal-body" style={{ padding: '24px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background:
                    targetStaffForStatus.status === 'ACTIVE' ? '#fee2e2' : '#edf5ee',
                  color: targetStaffForStatus.status === 'ACTIVE' ? '#dc2626' : '#253f2c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                {targetStaffForStatus.status === 'ACTIVE' ? (
                  <UserX size={20} />
                ) : (
                  <UserCheck size={20} />
                )}
              </div>

              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700' }}>
                {targetStaffForStatus.status === 'ACTIVE'
                  ? 'Vô hiệu hóa nhân sự nội bộ?'
                  : 'Kích hoạt lại nhân sự?'}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#5c6e61' }}>
                <strong>{targetStaffForStatus.full_name || targetStaffForStatus.username}</strong>{' '}
                {targetStaffForStatus.status === 'ACTIVE'
                  ? 'sẽ không thể đăng nhập vào Admin Portal.'
                  : 'sẽ được khôi phục quyền truy cập vào Admin Portal.'}
              </p>

              {targetStaffForStatus.status === 'ACTIVE' && (
                <div className="staff-form-group">
                  <label className="staff-form-label">Lý do *</label>
                  <input
                    type="text"
                    className="staff-form-input"
                    placeholder="Nhập lý do vô hiệu hóa..."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    required
                  />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '20px',
                }}
              >
                <button
                  type="button"
                  className="staff-btn-cancel"
                  onClick={() => setIsStatusModalOpen(false)}
                  disabled={isStatusSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className={
                    targetStaffForStatus.status === 'ACTIVE'
                      ? 'staff-btn-danger'
                      : 'staff-btn-submit'
                  }
                  onClick={handleToggleStatusSubmit}
                  disabled={isStatusSubmitting}
                >
                  {isStatusSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : targetStaffForStatus.status === 'ACTIVE' ? (
                    'Vô hiệu hóa'
                  ) : (
                    'Kích hoạt lại'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Đặt lại mật khẩu */}
      {isResetPwdModalOpen && targetStaffForPwd && (
        <div className="staff-modal-overlay">
          <div className="staff-modal-container" style={{ maxWidth: '400px' }}>
            <div className="staff-modal-header">
              <h3 className="staff-modal-title">Đặt lại mật khẩu</h3>
              <button
                type="button"
                className="staff-modal-close-btn"
                onClick={() => setIsResetPwdModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleResetPwdSubmit}>
              <div className="staff-modal-body">
                {resetPwdError && (
                  <div className="staff-alert-error">
                    <AlertCircle size={16} />
                    <span>{resetPwdError}</span>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: '13.5px', color: '#5c6e61' }}>
                  Đặt lại mật khẩu cho{' '}
                  <strong>{targetStaffForPwd.full_name || targetStaffForPwd.username}</strong> (@
                  {targetStaffForPwd.username}):
                </p>

                <div className="staff-form-group">
                  <label className="staff-form-label">Mật khẩu mới *</label>
                  <input
                    type="password"
                    className="staff-form-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-btn-cancel"
                  onClick={() => setIsResetPwdModalOpen(false)}
                  disabled={isResetPwdSubmitting}
                >
                  Hủy
                </button>
                <button type="submit" className="staff-btn-submit" disabled={isResetPwdSubmitting}>
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
    </div>
  );
}

export default InternalStaffPage;
