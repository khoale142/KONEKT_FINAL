import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ChevronDown,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { adminTenantApi } from '../api/adminTenantApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import { PageLoader } from '../../../../components/feedback/PageLoader.jsx';
import './TenantListPage.css';

export function TenantListPage() {
  const navigate = useNavigate();

  // Data & Filters
  const [tenants, setTenants] = useState([]);
  const [counts, setCounts] = useState({ all_count: 0, active_count: 0, inactive_count: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOption, setSortOption] = useState('newest'); // 'newest' | 'name_asc' | 'name_desc' | 'stores_desc'
  const [isSortOpen, setIsSortOpen] = useState(false);

  // Active action menu id
  const [actionMenuId, setActionMenuId] = useState(null);

  // Create Tenant Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const sortDropdownRef = useRef(null);
  const tableRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch tenants
  const fetchTenants = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminTenantApi.getTenants({
        search: debouncedSearch,
        status: activeTab,
        sort: sortOption,
        page: pagination.page,
        limit: pagination.limit,
      });

      setTenants(res.data?.tenants || []);
      setPagination(res.data?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
      setCounts(res.data?.counts || { all_count: 0, active_count: 0, inactive_count: 0 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tổ chức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [activeTab, debouncedSearch, sortOption, pagination.page]);

  // Click outside to close menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
      if (tableRef.current && !event.target.closest('.tenant-action-wrapper')) {
        setActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Status toggle handler
  const handleToggleStatus = async (tenant) => {
    const nextStatus = tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setActionMenuId(null);
    try {
      await adminTenantApi.toggleStatus(tenant.id, nextStatus);
      fetchTenants();
    } catch (err) {
      alert(err.message || 'Thao tác đổi trạng thái thất bại.');
    }
  };

  // Create tenant handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!createForm.name.trim()) {
      setFormError('Vui lòng nhập tên tổ chức.');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminTenantApi.createTenant(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        status: 'ACTIVE',
      });
      fetchTenants();
    } catch (err) {
      setFormError(err.message || 'Không thể tạo tổ chức mới.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMonogram = (name) => {
    if (!name) return 'TN';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'name_asc': return 'Tên A-Z';
      case 'name_desc': return 'Tên Z-A';
      case 'stores_desc': return 'Cửa hàng nhiều nhất';
      case 'newest':
      default: return 'Mới nhất';
    }
  };

  return (
    <div className="admin-page-container">
      <div className="tenant-page-container">
        {/* Page Header */}
        <div className="tenant-page-header">
          <div className="tenant-page-title-box">
            <h1 className="tenant-page-title">Tổ chức</h1>
            <p className="tenant-page-subtitle">Quản lý các tổ chức đang sử dụng KONEKT.</p>
          </div>
          <button
            type="button"
            className="tenant-create-btn"
            onClick={() => {
              setFormError('');
              setIsCreateModalOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Tạo tổ chức</span>
          </button>
        </div>

        {/* Tabs Row */}
        <div className="tenant-tabs-row">
          <button
            type="button"
            className={`tenant-tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ALL');
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <span>Tất cả</span>
            <span className="tenant-tab-badge">{counts.all_count}</span>
          </button>
          <button
            type="button"
            className={`tenant-tab-btn ${activeTab === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ACTIVE');
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <span>Hoạt động</span>
            <span className="tenant-tab-badge">{counts.active_count}</span>
          </button>
          <button
            type="button"
            className={`tenant-tab-btn ${activeTab === 'INACTIVE' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('INACTIVE');
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <span>Ngừng hoạt động</span>
            <span className="tenant-tab-badge">{counts.inactive_count}</span>
          </button>
        </div>

        {/* Card Table Container */}
        <div className="tenant-card-table" ref={tableRef}>
          {/* Toolbar */}
          <div className="tenant-toolbar">
            <div className="tenant-search-wrapper">
              <Search size={18} className="tenant-search-icon" />
              <input
                id="searchInput"
                type="text"
                className="tenant-search-input"
                placeholder="Tìm theo tên hoặc mã tổ chức..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Sort Dropdown */}
            <div style={{ position: 'relative' }} ref={sortDropdownRef}>
              <button
                type="button"
                className="tenant-sort-btn"
                onClick={() => setIsSortOpen(!isSortOpen)}
              >
                <span style={{ color: '#6f786b' }}>Sắp xếp:</span>
                <span>{getSortLabel()}</span>
                <ChevronDown size={16} color="#6f786b" />
              </button>

              {isSortOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    width: '180px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1c1a9',
                    borderRadius: '8px',
                    boxShadow: '0 8px 20px rgba(60, 86, 66, 0.12)',
                    padding: '4px',
                    zIndex: 50,
                  }}
                >
                  {[
                    { id: 'newest', label: 'Mới nhất' },
                    { id: 'name_asc', label: 'Tên A-Z' },
                    { id: 'name_desc', label: 'Tên Z-A' },
                    { id: 'stores_desc', label: 'Cửa hàng nhiều nhất' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortOption(opt.id);
                        setIsSortOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        border: 'none',
                        background: sortOption === opt.id ? '#edf3ea' : 'transparent',
                        color: sortOption === opt.id ? '#3c5642' : '#263426',
                        fontWeight: sortOption === opt.id ? 600 : 500,
                        fontSize: '12.5px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table Area */}
          <div className="tenant-table-wrapper">
            {loading && tenants.length === 0 ? (
              <div style={{ padding: '60px 0' }}>
                <PageLoader message="Đang tải danh sách tổ chức..." />
              </div>
            ) : error ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9a5d5a' }}>
                <AlertCircle size={24} style={{ margin: '0 auto 8px auto' }} />
                <div>{error}</div>
              </div>
            ) : tenants.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6f786b' }}>
                <Building2 size={32} style={{ margin: '0 auto 8px auto', opacity: 0.6 }} />
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#263426' }}>
                  Không tìm thấy tổ chức nào
                </div>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>
                  Thử thay đổi bộ lọc tìm kiếm hoặc tạo tổ chức mới.
                </p>
              </div>
            ) : (
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>TỔ CHỨC</th>
                    <th>CỬA HÀNG</th>
                    <th>THÀNH VIÊN</th>
                    <th>TRẠNG THÁI</th>
                    <th>
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      {/* Organization Column */}
                      <td>
                        <div className="tenant-name-col">
                          <div
                            className={`tenant-monogram ${
                              t.status !== 'ACTIVE' ? 'inactive' : ''
                            }`}
                          >
                            {getMonogram(t.name)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="tenant-title">{t.name}</span>
                            <span className="tenant-slug">{t.slug || t.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Stores Count */}
                      <td style={{ fontWeight: 500 }}>{t.stores_count || 0}</td>

                      {/* Members Count */}
                      <td style={{ fontWeight: 500 }}>{t.members_count || 0}</td>

                      {/* Status Column */}
                      <td>
                        <div
                          className={`tenant-status-indicator ${
                            t.status !== 'ACTIVE' ? 'inactive' : ''
                          }`}
                        >
                          <span
                            className={`tenant-status-dot ${
                              t.status !== 'ACTIVE' ? 'inactive' : ''
                            }`}
                          />
                          <span>{t.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng HĐ'}</span>
                        </div>
                      </td>

                      {/* Action Menu */}
                      <td>
                        <div className="tenant-action-wrapper" style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className={`tenant-action-btn ${actionMenuId === t.id ? 'active' : ''}`}
                            onClick={() => setActionMenuId(actionMenuId === t.id ? null : t.id)}
                            aria-label="Thao tác"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {/* Action Dropdown Menu */}
                          {actionMenuId === t.id && (
                            <div className="tenant-dropdown-menu">
                              <button
                                type="button"
                                className="tenant-dropdown-item"
                                onClick={() => {
                                  setActionMenuId(null);
                                  navigate(`/admin/tenants/${t.id}`);
                                }}
                              >
                                <Eye size={15} color="#6f786b" />
                                <span>Xem chi tiết</span>
                              </button>

                              <div className="tenant-dropdown-divider" />

                              {t.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  className="tenant-dropdown-item danger"
                                  onClick={() => handleToggleStatus(t)}
                                >
                                  <Ban size={15} />
                                  <span>Vô hiệu hóa</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="tenant-dropdown-item"
                                  style={{ color: '#3c5642' }}
                                  onClick={() => handleToggleStatus(t)}
                                >
                                  <CheckCircle2 size={15} color="#3c5642" />
                                  <span>Kích hoạt lại</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="tenant-pagination-footer">
            <div className="tenant-pagination-summary">
              <strong>{pagination.total}</strong> tổ chức
            </div>

            <div className="tenant-pagination-controls">
              <button
                type="button"
                className="tenant-page-num-btn"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
                .map((p, idx, arr) => {
                  const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {showEllipsisBefore && (
                        <span style={{ fontSize: '12px', color: '#6f786b', padding: '0 4px' }}>...</span>
                      )}
                      <button
                        type="button"
                        className={`tenant-page-num-btn ${pagination.page === p ? 'active' : ''}`}
                        onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}

              <button
                type="button"
                className="tenant-page-num-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                title="Trang kế tiếp"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tạo tổ chức mới */}
      {isCreateModalOpen && (
        <div className="tenant-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="tenant-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tenant-modal-header">
              <h2 className="tenant-modal-title">Tạo tổ chức mới</h2>
              <button
                type="button"
                className="tenant-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="tenant-modal-form">
                {formError && (
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
                    {formError}
                  </div>
                )}

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="tenant-name">
                    Tên tổ chức *
                  </label>
                  <input
                    id="tenant-name"
                    type="text"
                    className="tenant-form-input"
                    placeholder="Ví dụ: ABC Coffee Roasters"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="tenant-slug">
                    Mã định danh (Slug)
                  </label>
                  <input
                    id="tenant-slug"
                    type="text"
                    className="tenant-form-input"
                    placeholder="tenant-abc-coffee (tự động nếu để trống)"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, slug: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="tenant-form-group">
                    <label className="tenant-form-label" htmlFor="tenant-email">
                      Email liên hệ
                    </label>
                    <input
                      id="tenant-email"
                      type="email"
                      className="tenant-form-input"
                      placeholder="contact@abc.vn"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div className="tenant-form-group">
                    <label className="tenant-form-label" htmlFor="tenant-phone">
                      Số điện thoại
                    </label>
                    <input
                      id="tenant-phone"
                      type="tel"
                      className="tenant-form-input"
                      placeholder="0901234567"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="tenant-form-group">
                  <label className="tenant-form-label" htmlFor="tenant-address">
                    Địa chỉ trụ sở
                  </label>
                  <textarea
                    id="tenant-address"
                    className="tenant-form-textarea"
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                    value={createForm.address}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
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
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Tạo tổ chức</span>
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

export default TenantListPage;
