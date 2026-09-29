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
} from 'lucide-react';
import { adminTenantApi } from '../api/adminTenantApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import { TenantOverview } from '../components/TenantOverview.jsx';
import { TenantOwners } from '../components/TenantOwners.jsx';
import { TenantStores } from '../components/TenantStores.jsx';
import { PageLoader } from '../../../../components/feedback/PageLoader.jsx';
import './TenantDetailPage.css';

export function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'owners' | 'stores'

  // Header Dropdown Menu
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);

  // Copy Tenant ID
  const [copiedId, setCopiedId] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Deactivate Modal State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivateSubmitting, setIsDeactivateSubmitting] = useState(false);

  const fetchTenant = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminTenantApi.getTenant(id);
      setTenant(res.data);
      setEditForm({
        name: res.data.name || '',
        slug: res.data.slug || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
      });
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin tổ chức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [id]);

  // Click outside to close header dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setIsHeaderMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyId = () => {
    if (!tenant) return;
    const text = tenant.slug || tenant.id;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editForm.name.trim()) {
      setEditError('Tên tổ chức là bắt buộc.');
      return;
    }

    try {
      setIsEditSubmitting(true);
      await adminTenantApi.updateTenant(tenant.id, editForm);
      setIsEditModalOpen(false);
      fetchTenant();
    } catch (err) {
      setEditError(err.message || 'Không thể lưu thay đổi thông tin tổ chức.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeactivateSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsDeactivateSubmitting(true);
      await adminTenantApi.toggleStatus(tenant.id, 'INACTIVE');
      setIsDeactivateModalOpen(false);
      setDeactivateReason('');
      fetchTenant();
    } catch (err) {
      alert(err.message || 'Vô hiệu hóa tổ chức thất bại.');
    } finally {
      setIsDeactivateSubmitting(false);
    }
  };

  const handleActivate = async () => {
    setIsHeaderMenuOpen(false);
    try {
      await adminTenantApi.toggleStatus(tenant.id, 'ACTIVE');
      fetchTenant();
    } catch (err) {
      alert(err.message || 'Kích hoạt tổ chức thất bại.');
    }
  };

  if (loading && !tenant) {
    return (
      <div className="admin-page-container">
        <PageLoader message="Đang tải chi tiết tổ chức..." />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="admin-page-container">
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <AlertCircle size={36} color="#9a5d5a" style={{ margin: '0 auto 12px auto' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#263426' }}>
            {error || 'Không tìm thấy tổ chức'}
          </h2>
          <Link
            to={ADMIN_ROUTES.TENANTS}
            className="tenant-btn-primary"
            style={{ display: 'inline-flex', marginTop: '16px' }}
          >
            <ArrowLeft size={16} />
            <span>Quay lại danh sách tổ chức</span>
          </Link>
        </div>
      </div>
    );
  }

  const getMonogram = (name) => {
    if (!name) return 'TN';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const ownersCount = tenant.owners?.length || 0;
  const storesCount = tenant.stores?.length || 0;

  return (
    <div className="admin-page-container">
      <div className="tenant-detail-page-container">
        {/* Breadcrumb back navigation */}
        <div>
          <Link to={ADMIN_ROUTES.TENANTS} className="tenant-back-nav">
            <ArrowLeft size={16} />
            <span>Tổ chức</span>
          </Link>
        </div>

        {/* Tenant Header Card */}
        <div className="tenant-header-card">
          <div className="tenant-header-main">
            <div className="tenant-header-monogram">
              {getMonogram(tenant.name)}
            </div>
            <div className="tenant-header-title-wrap">
              <div className="tenant-header-title-row">
                <h1 className="tenant-header-title">{tenant.name}</h1>
                <span
                  className={`tenant-status-indicator ${tenant.status !== 'ACTIVE' ? 'inactive' : ''}`}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    backgroundColor: tenant.status === 'ACTIVE' ? '#edf3ea' : '#f8ece9',
                    border: `1px solid ${tenant.status === 'ACTIVE' ? '#ccdac8' : '#e7c9c3'}`,
                  }}
                >
                  <span className={`tenant-status-dot ${tenant.status !== 'ACTIVE' ? 'inactive' : ''}`} />
                  <span>{tenant.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}</span>
                </span>
              </div>
              <div className="tenant-header-subline">
                <span className="tenant-header-tnt-id">{tenant.slug || tenant.id}</span>
                <button
                  type="button"
                  className="tenant-copy-icon-btn"
                  onClick={handleCopyId}
                  title="Sao chép Tenant ID"
                >
                  {copiedId ? <Check size={14} color="#3c5642" /> : <Copy size={14} />}
                </button>
                <span>•</span>
                <span>
                  Tạo ngày {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('vi-VN') : '14/10/2023'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="tenant-header-menu-wrap" ref={headerMenuRef}>
            <button
              type="button"
              className="tenant-more-horiz-btn"
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              title="Thao tác"
            >
              <MoreHorizontal size={20} />
            </button>

            {isHeaderMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  marginTop: '6px',
                  width: '200px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1c1a9',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(60, 86, 66, 0.15)',
                  padding: '4px',
                  zIndex: 50,
                }}
              >
                <button
                  type="button"
                  className="tenant-dropdown-item"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setEditError('');
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit size={16} color="#6f786b" />
                  <span>Chỉnh sửa thông tin</span>
                </button>

                <div className="tenant-dropdown-divider" />

                {tenant.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    className="tenant-dropdown-item danger"
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsDeactivateModalOpen(true);
                    }}
                  >
                    <Ban size={16} />
                    <span>Vô hiệu hóa tổ chức</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="tenant-dropdown-item"
                    style={{ color: '#3c5642' }}
                    onClick={handleActivate}
                  >
                    <CheckCircle2 size={16} color="#3c5642" />
                    <span>Kích hoạt lại tổ chức</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3 Tabs Navigation Bar */}
        <div className="tenant-detail-tabs-bar">
          <button
            type="button"
            className={`tenant-detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>Tổng quan</span>
          </button>
          <button
            type="button"
            className={`tenant-detail-tab-btn ${activeTab === 'owners' ? 'active' : ''}`}
            onClick={() => setActiveTab('owners')}
          >
            <span>Chủ sở hữu</span>
            <span className="count-pill">{ownersCount}</span>
          </button>
          <button
            type="button"
            className={`tenant-detail-tab-btn ${activeTab === 'stores' ? 'active' : ''}`}
            onClick={() => setActiveTab('stores')}
          >
            <span>Cửa hàng</span>
            <span className="count-pill">{storesCount}</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'overview' && (
          <TenantOverview
            tenant={tenant}
            onEdit={() => {
              setEditError('');
              setIsEditModalOpen(true);
            }}
            onSwitchTab={(tabKey) => setActiveTab(tabKey)}
          />
        )}

        {activeTab === 'owners' && (
          <TenantOwners
            tenant={tenant}
            onRefresh={fetchTenant}
          />
        )}

        {activeTab === 'stores' && (
          <TenantStores
            tenant={tenant}
          />
        )}
      </div>

      {/* Modal 1: Chỉnh sửa tổ chức */}
      {isEditModalOpen && (
        <div className="tenant-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="tenant-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tenant-modal-header">
              <h2 className="tenant-modal-title">Chỉnh sửa tổ chức</h2>
              <button
                type="button"
                className="tenant-modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="tenant-modal-form">
                {editError && (
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
                    {editError}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'rgba(243, 237, 227, 0.6)',
                    borderRadius: '8px',
                    border: '1px solid #dfd9d0',
                    fontSize: '12.5px',
                  }}
                >
                  <div>
                    <span style={{ display: 'block', color: '#6f786b', fontWeight: 500 }}>Tenant ID (Chỉ đọc)</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1d1b16' }}>{tenant.id}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', color: '#6f786b', fontWeight: 500 }}>Ngày tạo (Chỉ đọc)</span>
                    <span style={{ fontWeight: 600, color: '#1d1b16' }}>
                      {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </div>
                </div>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="edit-name">
                    Tên tổ chức pháp nhân *
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    className="tenant-form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="edit-slug">
                    Slug định danh *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '0 12px',
                        height: '40px',
                        backgroundColor: '#eee6da',
                        border: '1px solid #d1c1a9',
                        borderRight: 'none',
                        borderRadius: '8px 0 0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '13px',
                        color: '#6f786b',
                        fontFamily: 'monospace',
                      }}
                    >
                      konekt.vn/
                    </span>
                    <input
                      id="edit-slug"
                      type="text"
                      className="tenant-form-input"
                      style={{ borderRadius: '0 8px 8px 0', fontFamily: 'monospace' }}
                      value={editForm.slug}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="tenant-form-group">
                    <label className="tenant-form-label" htmlFor="edit-email">
                      Email liên hệ
                    </label>
                    <input
                      id="edit-email"
                      type="email"
                      className="tenant-form-input"
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div className="tenant-form-group">
                    <label className="tenant-form-label" htmlFor="edit-phone">
                      Số điện thoại
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      className="tenant-form-input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="edit-address">
                    Địa chỉ trụ sở
                  </label>
                  <textarea
                    id="edit-address"
                    className="tenant-form-textarea"
                    value={editForm.address}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isEditSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="tenant-btn-primary"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Vô hiệu hóa tổ chức */}
      {isDeactivateModalOpen && (
        <div className="tenant-modal-backdrop" onClick={() => setIsDeactivateModalOpen(false)}>
          <div className="tenant-modal-box" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleDeactivateSubmit}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#fdf2f0',
                      color: '#ba1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1d1b16', margin: 0 }}>
                      Vô hiệu hóa tổ chức?
                    </h3>
                  </div>
                </div>

                <p style={{ fontSize: '13.5px', color: '#51452e', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                  Tổ chức <strong style={{ color: '#1d1b16' }}>{tenant.name}</strong> và toàn bộ {storesCount} cửa hàng trực thuộc sẽ bị tạm ngừng hoạt động. Nhân sự thuộc tổ chức sẽ không thể truy cập hệ thống POS và quản trị.
                </p>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="deact-reason">
                    Lý do vô hiệu hóa *
                  </label>
                  <textarea
                    id="deact-reason"
                    className="tenant-form-textarea"
                    placeholder="Nhập lý do vô hiệu hóa tổ chức để lưu nhật ký kiểm toán..."
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn-secondary"
                  onClick={() => setIsDeactivateModalOpen(false)}
                  disabled={isDeactivateSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="tenant-btn-primary"
                  style={{ backgroundColor: '#ba1a1a' }}
                  disabled={isDeactivateSubmitting}
                >
                  {isDeactivateSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <span>Vô hiệu hóa</span>
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

export default TenantDetailPage;
