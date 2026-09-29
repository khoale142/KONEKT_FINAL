import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Store, ChevronRight } from 'lucide-react';

export function TenantStores({ tenant }) {
  const navigate = useNavigate();
  const stores = tenant.stores || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  const filteredStores = stores.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      s.name.toLowerCase().includes(term) ||
      (s.invite_code && s.invite_code.toLowerCase().includes(term));
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.status === 'ACTIVE') ||
      (statusFilter === 'inactive' && s.status !== 'ACTIVE');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="tab-pane-stack">
      {/* Header & Controls */}
      <div className="tab-header-row">
        <div className="tab-title-badge-row">
          <h2 className="card-heading">Cửa hàng</h2>
          <span className="count-pill">{stores.length}</span>
        </div>

        <div className="store-filters-wrap">
          <div className="store-search-box">
            <Search size={16} className="store-search-icon" />
            <input
              type="text"
              className="store-search-input"
              placeholder="Tìm cửa hàng theo tên hoặc mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="store-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </div>
      </div>

      {/* Stores Table Card */}
      <div className="tenant-card-table">
        <div className="tenant-table-wrapper">
          {filteredStores.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6f786b' }}>
              <Store size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#263426' }}>
                {stores.length === 0 ? 'Tổ chức này chưa có cửa hàng nào' : 'Không tìm thấy cửa hàng phù hợp'}
              </div>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                {stores.length === 0
                  ? 'Các cửa hàng sẽ xuất hiện tại đây khi chủ tổ chức khởi tạo.'
                  : 'Hãy thử thay đổi điều kiện tìm kiếm hoặc bộ lọc trạng thái.'}
              </p>
            </div>
          ) : (
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>CỬA HÀNG</th>
                  <th>THÀNH VIÊN</th>
                  <th>TRẠNG THÁI</th>
                  <th style={{ textAlign: 'right' }}>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((s) => {
                  const storeId = s.id || s.store_id || s.storeId;
                  return (
                    <tr
                      key={storeId}
                      className="clickable-store-row"
                      onClick={() => navigate(`/admin/stores/${storeId}`)}
                    >
                    <td>
                      <div className="tenant-name-col">
                        <div
                          className={`store-icon-box ${s.status !== 'ACTIVE' ? 'inactive' : ''}`}
                        >
                          <Store size={18} />
                        </div>
                        <div>
                          <div className="tenant-title store-hover-title">{s.name}</div>
                          <div className="tenant-slug">{s.invite_code}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ fontWeight: 500 }}>{s.staff_count || 0} thành viên</td>

                    <td>
                      <div
                        className={`tenant-status-indicator ${
                          s.status !== 'ACTIVE' ? 'inactive' : ''
                        }`}
                      >
                        <span
                          className={`tenant-status-dot ${
                            s.status !== 'ACTIVE' ? 'inactive' : ''
                          }`}
                        />
                        <span>{s.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}</span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <ChevronRight size={18} color="#6f786b" className="row-chevron" />
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default TenantStores;
