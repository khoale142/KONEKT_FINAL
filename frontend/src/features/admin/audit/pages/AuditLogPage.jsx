import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Download,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  FileText,
  Badge,
  ArrowRight,
  FileSpreadsheet,
  Code,
  FileCheck,
  Copy,
  Check,
  Calendar,
  Layers,
  Activity,
} from 'lucide-react';
import { fetchAuditLogs, exportAuditLogs } from '../api/adminAuditApi.js';
import './AuditLogPage.css';

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL query params initialization
  const initialActorId = searchParams.get('actorId') || 'ALL';
  const initialScope = searchParams.get('scope') || 'ALL';
  const initialActionType = searchParams.get('actionType') || 'ALL';

  // Filters State
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState(initialActionType);
  const [scope, setScope] = useState(initialScope);
  const [actorId, setActorId] = useState(initialActorId);
  const [timeRange, setTimeRange] = useState('7D');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data State
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [filterOptions, setFilterOptions] = useState({ actors: [], actionTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Export State
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Drawer State
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [techDetailsOpen, setTechDetailsOpen] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch Data function
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAuditLogs({
        search,
        actionType,
        scope,
        actorId,
        timeRange,
        page,
        limit,
      });

      if (res?.data?.data) {
        setLogs(res.data.data);
        if (res.data.pagination) setPagination(res.data.pagination);
        if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Không thể tải nhật ký kiểm toán. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [search, actionType, scope, actorId, timeRange, page, limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle row click to open Drawer
  const handleRowClick = (item) => {
    setSelectedEvent(item);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Copy Event ID
  const handleCopyEventId = () => {
    if (!selectedEvent?.id) return;
    navigator.clipboard.writeText(selectedEvent.id);
    setCopiedId(true);
    setTimeout(() => {
      setCopiedId(false);
    }, 2000);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setActionType('ALL');
    setScope('ALL');
    setActorId('ALL');
    setTimeRange('7D');
    setPage(1);
    setSearchParams({});
  };

  // Export CSV / JSON
  const handleExport = async (format) => {
    try {
      setExporting(true);
      setExportOpen(false);
      await exportAuditLogs(
        {
          search,
          actionType,
          scope,
          actorId,
          timeRange,
        },
        format
      );
    } catch (err) {
      alert(err.message || 'Lỗi khi xuất dữ liệu');
    } finally {
      setExporting(false);
    }
  };

  // Close export dropdown on click outside
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.audit-export-wrapper')) {
        setExportOpen(false);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="audit-page-container" data-purpose="audit-log-page">
      {/* 1. Header */}
      <div className="audit-header">
        <div>
          <h1 className="audit-header-title">Nhật ký kiểm toán</h1>
          <p className="audit-header-subtitle">
            Theo dõi các thay đổi và thao tác quản trị trên toàn bộ hệ thống.
          </p>
        </div>

        {/* Export Dropdown */}
        <div className="audit-export-wrapper">
          <button
            type="button"
            className="audit-export-btn"
            onClick={() => setExportOpen((prev) => !prev)}
            disabled={exporting}
          >
            <Download size={15} />
            <span>{exporting ? 'Đang xuất...' : 'Xuất dữ liệu'}</span>
            <ChevronDown size={14} />
          </button>

          {exportOpen && (
            <div className="audit-export-menu">
              <button
                type="button"
                className="audit-export-item"
                onClick={() => handleExport('csv')}
              >
                <FileSpreadsheet size={15} className="text-emerald-700" />
                <span>Xuất CSV (bộ lọc)</span>
              </button>
              <button
                type="button"
                className="audit-export-item"
                onClick={() => handleExport('json')}
              >
                <Code size={15} className="text-amber-700" />
                <span>Xuất JSON (bộ lọc)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Toolbar Tinh Gọn 2 Hàng */}
      <div className="audit-toolbar-card">
        {/* Hàng 1: Search bar rộng toàn phần */}
        <div className="audit-search-row">
          <Search size={16} className="audit-search-icon" />
          <input
            type="text"
            className="audit-search-input"
            placeholder="Tìm người thực hiện, đối tượng hoặc mã sự kiện..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Hàng 2: Dropdowns bộ lọc + Nút Xóa bộ lọc */}
        <div className="audit-filters-row">
          <div className="audit-filters-left">
            {/* Loại hoạt động */}
            <div className="audit-filter-pill">
              <span className="audit-filter-label">Loại hoạt động:</span>
              <select
                className="audit-filter-select"
                value={actionType}
                onChange={(e) => {
                  setActionType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả</option>
                <option value="DEACTIVATE_TENANT">Vô hiệu hóa</option>
                <option value="ACTIVATE_STORE">Kích hoạt</option>
                <option value="CHANGE_STORE_ROLE">Thay đổi vai trò</option>
                <option value="RESET_USER_PASSWORD">Đặt lại mật khẩu</option>
                <option value="GRANT_INTERNAL_STAFF">Thêm nhân sự</option>
                <option value="UPDATE_TENANT_STATUS">Cập nhật tổ chức</option>
                <option value="SUSPEND_ACCOUNT">Khóa tài khoản</option>
              </select>
            </div>

            {/* Phạm vi */}
            <div className="audit-filter-pill">
              <span className="audit-filter-label">Phạm vi:</span>
              <select
                className="audit-filter-select"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả</option>
                <option value="Tenant">Tenant</option>
                <option value="Store">Store</option>
                <option value="Account">Account</option>
                <option value="Nhân sự">Nhân sự</option>
              </select>
            </div>

            {/* Người thực hiện */}
            <div className="audit-filter-pill">
              <span className="audit-filter-label">Người thực hiện:</span>
              <select
                className="audit-filter-select"
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả</option>
                {filterOptions.actors?.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Khoảng thời gian */}
            <div className="audit-filter-pill">
              <Calendar size={14} className="text-[#5F6E5F]" />
              <select
                className="audit-filter-select"
                value={timeRange}
                onChange={(e) => {
                  setTimeRange(e.target.value);
                  setPage(1);
                }}
              >
                <option value="TODAY">Hôm nay</option>
                <option value="7D">7 ngày qua</option>
                <option value="30D">30 ngày qua</option>
                <option value="ALL">Tất cả thời gian</option>
              </select>
            </div>
          </div>

          {/* Nút xóa bộ lọc */}
          <button
            type="button"
            className="audit-reset-btn"
            onClick={handleResetFilters}
            title="Đặt lại các bộ lọc"
          >
            <RotateCcw size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      {/* 3. Bảng Sự Kiện 4 Cột */}
      <div className="audit-table-card">
        <table className="audit-table">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>THỜI GIAN</th>
              <th style={{ width: '220px' }}>NGƯỜI THỰC HIỆN</th>
              <th>HOẠT ĐỘNG</th>
              <th style={{ width: '130px', textAlign: 'right' }}>PHẠM VI</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#5F6E5F' }}>
                  Đang tải dữ liệu kiểm toán...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#DC2626' }}>
                  {error}
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#5F6E5F' }}>
                  Không tìm thấy sự kiện kiểm toán nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              logs.map((item) => {
                const isSelected = selectedEvent?.id === item.id && isDrawerOpen;
                return (
                  <tr
                    key={item.id}
                    className={isSelected ? 'row-selected' : ''}
                    onClick={() => handleRowClick(item)}
                  >
                    {/* Cột 1: Thời gian */}
                    <td className="audit-cell-time">
                      <div className="audit-time-val">{item.time}</div>
                      <div className="audit-date-val">{item.date}</div>
                    </td>

                    {/* Cột 2: Người thực hiện */}
                    <td>
                      <div className="audit-actor-cell">
                        <div className="audit-actor-avatar">{item.actor.initial}</div>
                        <div>
                          <div className="audit-actor-name">{item.actor.name}</div>
                          <div className="audit-actor-email">{item.actor.maskedEmail}</div>
                        </div>
                      </div>
                    </td>

                    {/* Cột 3: Hoạt động */}
                    <td>
                      <div className="audit-action-cell">
                        <span
                          className="audit-action-badge"
                          style={{
                            backgroundColor: item.actionBadge.bg,
                            color: item.actionBadge.color,
                          }}
                        >
                          {item.actionBadge.label}
                        </span>
                        <span className="audit-target-text">
                          {item.target.name}
                          {item.target.code && (
                            <span className="audit-target-code">({item.target.code})</span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Cột 4: Phạm vi */}
                    <td style={{ textAlign: 'right' }}>
                      <div className="audit-scope-cell">
                        <span>{item.scope}</span>
                        <ChevronRight size={16} className="text-zinc-400" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Phân Trang (Pagination) */}
        <div className="audit-pagination-bar">
          <div className="audit-pagination-left">
            <span>
              <strong>{pagination.total.toLocaleString()}</strong> sự kiện
            </span>
            <select
              className="audit-page-size-select"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10 / trang</option>
              <option value={20}>20 / trang</option>
              <option value={50}>50 / trang</option>
              <option value={100}>100 / trang</option>
            </select>
          </div>

          <div className="audit-pagination-controls">
            <button
              type="button"
              className="audit-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  type="button"
                  className={`audit-page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}

            {pagination.totalPages > 5 && (
              <>
                <span className="px-1 text-zinc-400">...</span>
                <button
                  type="button"
                  className={`audit-page-btn ${page === pagination.totalPages ? 'active' : ''}`}
                  onClick={() => setPage(pagination.totalPages)}
                >
                  {pagination.totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              className="audit-page-btn"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Backdrop Overlay */}
      <div
        className={`audit-drawer-backdrop ${isDrawerOpen ? 'open' : ''}`}
        onClick={handleCloseDrawer}
      />

      {/* 5. Event Detail Drawer (480px Slide-over) */}
      <aside
        className={`audit-drawer ${isDrawerOpen ? 'open' : ''}`}
        aria-label="Chi tiết sự kiện kiểm toán"
      >
        {selectedEvent && (
          <>
            {/* Header Drawer */}
            <div className="audit-drawer-header">
              <div>
                <h2 className="audit-drawer-title">{selectedEvent.title}</h2>
                <div className="audit-drawer-meta">
                  <span className="audit-drawer-event-id">#{selectedEvent.id}</span>
                  <span className="text-zinc-400">•</span>
                  <span className="audit-drawer-timestamp">{selectedEvent.timestamp}</span>
                </div>
              </div>
              <button
                type="button"
                className="audit-drawer-close-btn"
                onClick={handleCloseDrawer}
                title="Đóng chi tiết"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Drawer */}
            <div className="audit-drawer-body">
              {/* Khối Tóm Tắt Sự Kiện (CALLOUT NỔI BẬT) */}
              <div className="audit-summary-card">
                <FileText size={18} className="audit-summary-icon" />
                <p className="audit-summary-text">
                  <strong>Tóm tắt: </strong>
                  {selectedEvent.summary}
                </p>
              </div>

              {/* Khối Đối Tượng & Người Thực Hiện */}
              <div>
                <div className="audit-section-heading">
                  <Badge size={14} />
                  <span>Đối tượng & Người thực hiện</span>
                </div>
                <div className="audit-info-card">
                  <div className="audit-info-row">
                    <span className="audit-info-key">Người thực hiện:</span>
                    <span className="audit-info-value">
                      {selectedEvent.actor.name}{' '}
                      <span className="font-mono text-zinc-500 font-normal">
                        ({selectedEvent.actor.maskedEmail})
                      </span>{' '}
                      -{' '}
                      <span className="text-zinc-500 font-normal text-[11px]">
                        {selectedEvent.actor.role}
                      </span>
                    </span>
                  </div>
                  <div className="audit-info-row">
                    <span className="audit-info-key">Đối tượng tác động:</span>
                    <span className="audit-info-value">
                      {selectedEvent.target.name}{' '}
                      {selectedEvent.target.code && (
                        <span className="font-mono text-zinc-500 font-normal">
                          ({selectedEvent.target.code})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="audit-info-row">
                    <span className="audit-info-key">Cửa hàng / Phạm vi:</span>
                    <span className="audit-info-value">{selectedEvent.location}</span>
                  </div>
                </div>
              </div>

              {/* Khối Thay Đổi Dữ Liệu (Before / After) */}
              <div>
                <div className="audit-section-heading">
                  <Activity size={14} />
                  <span>Thay đổi dữ liệu</span>
                </div>
                <div className="audit-diff-card">
                  <div className="audit-diff-block">
                    <span className="audit-diff-label">Trước</span>
                    <span className="audit-diff-val-before">{selectedEvent.diff.before}</span>
                  </div>
                  <div className="audit-diff-arrow">
                    <ArrowRight size={18} />
                  </div>
                  <div className="audit-diff-block" style={{ alignItems: 'flex-end' }}>
                    <span className="audit-diff-label text-[#3C5642]">Sau</span>
                    <span
                      className={`audit-diff-val-after ${
                        selectedEvent.diff.afterClass || 'bg-zinc-800 text-white'
                      }`}
                    >
                      {selectedEvent.diff.after}
                    </span>
                  </div>
                </div>
              </div>

              {/* Khối Lý Do Thực Hiện */}
              <div>
                <div className="audit-section-heading">
                  <FileCheck size={14} />
                  <span>Lý do thực hiện</span>
                </div>
                <div className="audit-reason-box">“{selectedEvent.reason}”</div>
              </div>

              {/* Khối Chi Tiết Kỹ Thuật (Accordion Collapse) */}
              <div className="audit-tech-accordion">
                <div
                  className="audit-tech-summary"
                  onClick={() => setTechDetailsOpen((prev) => !prev)}
                >
                  <div className="audit-section-heading" style={{ margin: 0 }}>
                    <Code size={14} />
                    <span>Chi tiết kỹ thuật</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#3C5642] font-semibold">
                    <span>{techDetailsOpen ? 'Thu gọn' : 'Chi tiết'}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: techDetailsOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    />
                  </div>
                </div>

                {techDetailsOpen && (
                  <div className="audit-tech-body">
                    <div className="audit-info-row">
                      <span className="audit-info-key">Mã sự kiện:</span>
                      <span className="font-mono text-zinc-900 font-semibold">
                        {selectedEvent.tech.eventId}
                      </span>
                    </div>
                    <div className="audit-info-row">
                      <span className="audit-info-key">Action Code:</span>
                      <span className="font-mono text-[11px] font-bold bg-white text-[#263426] px-1.5 py-0.5 rounded border border-[#E6DFC6]">
                        {selectedEvent.tech.actionCode}
                      </span>
                    </div>
                    <div className="audit-info-row">
                      <span className="audit-info-key">Địa chỉ IP:</span>
                      <span className="font-mono text-zinc-800">{selectedEvent.tech.ip}</span>
                    </div>
                    <div className="audit-info-row">
                      <span className="audit-info-key">Thiết bị / User Agent:</span>
                      <span className="text-zinc-800">{selectedEvent.tech.userAgent}</span>
                    </div>
                    <div className="audit-info-row">
                      <span className="audit-info-key">Request ID:</span>
                      <span className="font-mono text-zinc-500 text-[11px]">
                        {selectedEvent.tech.requestId}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Drawer */}
            <div className="audit-drawer-footer">
              <button
                type="button"
                className={`audit-copy-id-btn ${copiedId ? 'copied' : ''}`}
                onClick={handleCopyEventId}
              >
                {copiedId ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedId ? 'Đã chép ID!' : 'Copy Event ID'}</span>
              </button>

              <button
                type="button"
                className="audit-close-btn-secondary"
                onClick={handleCloseDrawer}
              >
                Đóng
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default AuditLogPage;
