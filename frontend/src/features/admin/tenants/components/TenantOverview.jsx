import { Copy, Check, ExternalLink, Edit, Store, Users, ShieldCheck, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function TenantOverview({ tenant, onEdit, onSwitchTab }) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    const idText = tenant.slug || tenant.id;
    navigator.clipboard.writeText(idText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const storesCount = tenant.stores?.length || tenant.stores_count || 0;
  const ownersCount = tenant.owners?.length || tenant.members_count || 0;
  const membersCount = tenant.stores?.reduce((acc, s) => acc + (s.staff_count || 0), 0) + ownersCount;

  return (
    <div className="tab-pane-grid">
      {/* Left Card: Thông tin tổ chức */}
      <div className="tenant-detail-card main-info-card">
        <div>
          <div className="card-header-row">
            <h2 className="card-heading">Thông tin tổ chức</h2>
          </div>

          <dl className="tenant-dl-list">
            <div className="tenant-dl-row">
              <dt className="tenant-dt">Tenant ID</dt>
              <dd className="tenant-dd flex-row-align">
                <span className="tenant-mono-val">{tenant.slug || tenant.id}</span>
                <button
                  type="button"
                  className="tenant-inline-copy-btn"
                  onClick={handleCopyId}
                  title="Sao chép Tenant ID"
                >
                  {copied ? <Check size={15} color="#3c5642" /> : <Copy size={15} />}
                </button>
              </dd>
            </div>

            <div className="tenant-dl-row">
              <dt className="tenant-dt">Tên tổ chức</dt>
              <dd className="tenant-dd font-bold-val">{tenant.name}</dd>
            </div>

            <div className="tenant-dl-row">
              <dt className="tenant-dt">Slug</dt>
              <dd className="tenant-dd flex-row-align font-mono-link">
                <ExternalLink size={15} color="#6f786b" />
                <span>konekt.vn/{tenant.slug || tenant.name.toLowerCase().replace(/\s+/g, '-')}</span>
              </dd>
            </div>

            {tenant.email && (
              <div className="tenant-dl-row">
                <dt className="tenant-dt">Email liên hệ</dt>
                <dd className="tenant-dd">{tenant.email}</dd>
              </div>
            )}

            {tenant.phone && (
              <div className="tenant-dl-row">
                <dt className="tenant-dt">Số điện thoại</dt>
                <dd className="tenant-dd">{tenant.phone}</dd>
              </div>
            )}

            {tenant.address && (
              <div className="tenant-dl-row">
                <dt className="tenant-dt">Địa chỉ trụ sở</dt>
                <dd className="tenant-dd">{tenant.address}</dd>
              </div>
            )}

            <div className="tenant-dl-row">
              <dt className="tenant-dt">Trạng thái</dt>
              <dd className="tenant-dd flex-row-align">
                <span
                  className="tenant-status-dot"
                  style={{
                    backgroundColor: tenant.status === 'ACTIVE' ? '#253f2c' : '#ba1a1a',
                  }}
                />
                <span style={{ fontWeight: 600, color: tenant.status === 'ACTIVE' ? '#253f2c' : '#ba1a1a' }}>
                  {tenant.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}
                </span>
              </dd>
            </div>

            <div className="tenant-dl-row">
              <dt className="tenant-dt">Ngày tạo</dt>
              <dd className="tenant-dd">
                {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString('vi-VN') : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card-footer-action">
          <button
            type="button"
            className="tenant-btn-outline"
            onClick={onEdit}
          >
            <Edit size={16} />
            <span>Chỉnh sửa</span>
          </button>
        </div>
      </div>

      {/* Right Card: Tóm tắt */}
      <div className="tenant-detail-card summary-card">
        <div className="card-header-row">
          <h2 className="card-heading">Tóm tắt</h2>
        </div>

        <div className="summary-list">
          <div
            className="summary-item clickable group"
            onClick={() => onSwitchTab('stores')}
          >
            <div className="summary-item-left">
              <Store size={20} className="summary-icon" />
              <span className="summary-label">Cửa hàng</span>
            </div>
            <div className="summary-val-wrap">
              <span className="summary-val">{storesCount}</span>
              <ChevronRight size={18} className="summary-arrow" />
            </div>
          </div>

          <div className="summary-item">
            <div className="summary-item-left">
              <Users size={20} className="summary-icon" />
              <span className="summary-label">Thành viên</span>
            </div>
            <span className="summary-val">{membersCount}</span>
          </div>

          <div
            className="summary-item clickable group"
            onClick={() => onSwitchTab('owners')}
          >
            <div className="summary-item-left">
              <ShieldCheck size={20} className="summary-icon" />
              <span className="summary-label">Chủ sở hữu</span>
            </div>
            <div className="summary-val-wrap">
              <span className="summary-val">{ownersCount}</span>
              <ChevronRight size={18} className="summary-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TenantOverview;
