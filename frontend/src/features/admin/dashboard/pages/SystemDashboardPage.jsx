import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Store,
  Users,
  AlertTriangle,
  ArrowRight,
  History,
  Building,
  Lock,
  Clock,
  User,
  RefreshCw,
} from 'lucide-react';
import { adminDashboardApi } from '../api/adminDashboardApi.js';
import { ADMIN_ROUTES } from '../../../../constants/adminRoutes.js';
import { PageLoader } from '../../../../components/feedback/PageLoader.jsx';
import './SystemDashboardPage.css';

export function SystemDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await adminDashboardApi.getStats();
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !data) {
    return (
      <div className="admin-page-container">
        <PageLoader message="Đang tải dữ liệu tổng quan hệ thống..." />
      </div>
    );
  }

  // Fallback defaults if API returns empty
  const overview = data?.overview || {
    tenants: { total: 0, active: 0, inactive: 0 },
    stores: { total: 0, active: 0, inactive: 0 },
    accounts: { total: 0, active: 0, inactive: 0 },
    attentionCount: 0,
  };

  const recentTenants = data?.recentTenants || [];
  const attentionItems = data?.attentionItems || [];
  const recentActivities = data?.recentActivities || [];

  const getMonogram = (name) => {
    if (!name) return 'TN';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Gần đây';
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  return (
    <div className="admin-page-container">
      <div className="admin-dashboard-container">
        {/* Page Title & Subtitle */}
        <div className="admin-dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="admin-dashboard-title">Tổng quan hệ thống</h1>
              <p className="admin-dashboard-subtitle">
                Theo dõi trạng thái nền tảng và các vấn đề cần xử lý.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="admin-icon-btn"
              title="Làm mới dữ liệu"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #d1c1a9',
                backgroundColor: '#fcfbfa',
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#ffdad6',
              color: '#93000a',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* 4 Stat Cards Grid */}
        <div className="admin-stats-grid">
          {/* Card 1: TENANTS */}
          <div className="admin-stat-card">
            <div className="admin-stat-card-header">
              <span className="admin-stat-label">TỔ CHỨC</span>
              <div className="admin-stat-icon-box">
                <Building2 size={18} />
              </div>
            </div>
            <div className="admin-stat-body">
              <span className="admin-stat-value">
                {overview.tenants.total.toLocaleString()}
              </span>
              <span className="admin-stat-badge">
                {overview.tenants.active.toLocaleString()} đang hoạt động
              </span>
            </div>
          </div>

          {/* Card 2: STORES */}
          <div className="admin-stat-card">
            <div className="admin-stat-card-header">
              <span className="admin-stat-label">CỬA HÀNG</span>
              <div className="admin-stat-icon-box">
                <Store size={18} />
              </div>
            </div>
            <div className="admin-stat-body">
              <span className="admin-stat-value">
                {overview.stores.total.toLocaleString()}
              </span>
              <span className="admin-stat-badge">
                {overview.stores.active.toLocaleString()} đang hoạt động
              </span>
            </div>
          </div>

          {/* Card 3: ACCOUNTS */}
          <div className="admin-stat-card">
            <div className="admin-stat-card-header">
              <span className="admin-stat-label">TÀI KHOẢN</span>
              <div className="admin-stat-icon-box">
                <Users size={18} />
              </div>
            </div>
            <div className="admin-stat-body">
              <span className="admin-stat-value">
                {overview.accounts.total.toLocaleString()}
              </span>
              <span className="admin-stat-badge">
                {overview.accounts.active.toLocaleString()} đang hoạt động
              </span>
            </div>
          </div>

          {/* Card 4: CẦN XỬ LÝ */}
          <div className="admin-stat-card">
            <div className="admin-stat-card-header">
              <span className="admin-stat-label label-danger">CẦN XỬ LÝ</span>
              <div className="admin-stat-icon-box box-danger">
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="admin-stat-body" style={{ justifyContent: 'space-between' }}>
              <span className="admin-stat-value value-danger">
                {overview.attentionCount}
              </span>
              <Link to={ADMIN_ROUTES.TENANTS} className="admin-stat-link">
                <span>Xem chi tiết</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        {/* 2-Column Middle Row */}
        <div className="admin-two-column-grid">
          {/* Left: TỔ CHỨC GẦN ĐÂY */}
          <div className="admin-card-section">
            <div>
              <div className="admin-card-section-header">
                <h2 className="admin-card-section-title">Tổ Chức Gần Đây</h2>
                <Building size={18} color="#6f786b" />
              </div>
              <div className="admin-card-list">
                {recentTenants.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#6f786b', fontSize: '13px' }}>
                    Chưa có tổ chức nào được tạo.
                  </div>
                ) : (
                  recentTenants.slice(0, 4).map((tenant, idx) => (
                    <Link
                      key={tenant.id}
                      to={ADMIN_ROUTES.TENANTS}
                      className="admin-card-list-item"
                    >
                      <div className="admin-item-left">
                        <div className={`admin-monogram-box ${idx % 3 === 1 ? 'alt-1' : idx % 3 === 2 ? 'alt-2' : ''}`}>
                          {getMonogram(tenant.name)}
                        </div>
                        <div>
                          <div className="admin-item-name">{tenant.name}</div>
                          {tenant.email && (
                            <div className="admin-item-subtitle">{tenant.email}</div>
                          )}
                        </div>
                      </div>
                      <span className="admin-stat-badge">
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: tenant.status === 'ACTIVE' ? '#587055' : '#9a5d5a',
                            display: 'inline-block',
                          }}
                        />
                        {tenant.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
            <div className="admin-card-section-footer">
              <Link to={ADMIN_ROUTES.TENANTS} className="admin-footer-link">
                <span>Xem tất cả tổ chức</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* Right: CẦN CHÚ Ý */}
          <div className="admin-card-section">
            <div>
              <div className="admin-card-section-header">
                <h2 className="admin-card-section-title">Cần Chú Ý</h2>
                <AlertTriangle size={18} color="#9a5d5a" />
              </div>
              <div className="admin-card-list">
                {attentionItems.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#587055', fontSize: '13.5px', fontWeight: 500 }}>
                    Tất cả tổ chức và tài khoản đều đang hoạt động bình thường.
                  </div>
                ) : (
                  attentionItems.map((item) => (
                    <Link
                      key={item.id}
                      to={item.link || ADMIN_ROUTES.TENANTS}
                      className="admin-card-list-item"
                    >
                      <div className="admin-item-left">
                        <div
                          className={`admin-attention-icon-box ${
                            item.severity === 'info' ? 'info' : ''
                          }`}
                        >
                          {item.type === 'TENANT' ? (
                            <Building2 size={18} />
                          ) : item.type === 'ACCOUNT' ? (
                            <Lock size={18} />
                          ) : (
                            <Clock size={18} />
                          )}
                        </div>
                        <span className="admin-item-name">{item.title}</span>
                      </div>
                      <span
                        className={`admin-attention-dot ${
                          item.severity === 'info' ? 'info' : ''
                        }`}
                      />
                    </Link>
                  ))
                )}
              </div>
            </div>
            <div className="admin-card-section-footer">
              <Link to={ADMIN_ROUTES.TENANTS} className="admin-footer-link">
                <span>Xem tất cả</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        {/* Full Width Bottom Section: HOẠT ĐỘNG QUẢN TRỊ GẦN ĐÂY */}
        <div className="admin-card-section">
          <div>
            <div className="admin-card-section-header">
              <h2 className="admin-card-section-title">Hoạt Động Quản Trị Gần Đây</h2>
              <History size={18} color="#6f786b" />
            </div>
            <div className="admin-card-list">
              {recentActivities.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#6f786b', fontSize: '13px' }}>
                  Chưa có nhật ký hoạt động nào.
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="admin-activity-item">
                    <div className="admin-item-left">
                      <div className="admin-activity-avatar">
                        <User size={16} />
                      </div>
                      <div className="admin-activity-text">
                        <strong className="admin-activity-actor">{act.adminName}</strong> —{' '}
                        <span>{act.action}</span>
                      </div>
                    </div>
                    <span className="admin-activity-time">
                      {formatRelativeTime(act.timeAgo)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="admin-card-section-footer justify-end">
            <Link to={ADMIN_ROUTES.AUDIT} className="admin-footer-link">
              <span>Xem nhật ký kiểm toán</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemDashboardPage;
