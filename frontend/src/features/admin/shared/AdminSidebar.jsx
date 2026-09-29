import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Contact2,
  History,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import { ADMIN_ROUTES } from '../../../constants/adminRoutes.js';

export function AdminSidebar() {
  const location = useLocation();

  const navItems = [
    {
      title: 'Tổng quan hệ thống',
      path: ADMIN_ROUTES.DASHBOARD,
      icon: LayoutDashboard,
      matchExact: true,
    },
    {
      title: 'Quản lý Tổ chức',
      path: ADMIN_ROUTES.TENANTS,
      icon: Building2,
    },
    {
      title: 'Quản lý Tài khoản',
      path: ADMIN_ROUTES.ACCOUNTS,
      icon: Users,
    },
    {
      title: 'Nhân sự Nội bộ',
      path: ADMIN_ROUTES.INTERNAL_STAFF,
      icon: Contact2,
    },
    {
      title: 'Nhật ký Kiểm toán',
      path: ADMIN_ROUTES.AUDIT,
      icon: History,
    },
    {
      title: 'Hồ sơ & Bảo mật',
      path: ADMIN_ROUTES.PROFILE,
      icon: ShieldCheck,
    },
  ];

  const isNavActive = (item) => {
    if (item.matchExact) {
      return location.pathname === item.path;
    }
    if (item.path === ADMIN_ROUTES.TENANTS) {
      return location.pathname.startsWith('/admin/tenants') || location.pathname.startsWith('/admin/stores');
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <aside className="admin-sidebar" data-purpose="admin-sidebar">
      <div className="admin-sidebar-top">
        {/* Brand Header */}
        <Link to={ADMIN_ROUTES.DASHBOARD} className="admin-sidebar-brand">
          <div className="admin-sidebar-logo-icon">
            <Shield size={18} strokeWidth={2.4} />
          </div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-name">KONEKT</span>
            <span className="admin-sidebar-brand-badge">Super Admin</span>
          </div>
        </Link>

        {/* Section Title */}
        <div className="admin-sidebar-section-title">Quản trị hệ thống</div>

        {/* Navigation Items */}
        <nav className="admin-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-sidebar-nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={19} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom System Status Widget */}
      <div className="admin-sidebar-bottom">
        <div className="admin-sidebar-status-box">
          <div className="admin-sidebar-status-content">
            <span className="admin-sidebar-ping-wrapper">
              <span className="admin-sidebar-ping-dot" />
              <span className="admin-sidebar-solid-dot" />
            </span>
            <div className="admin-sidebar-status-text">
              <span className="admin-sidebar-status-label">Trạng thái hệ thống</span>
              <span className="admin-sidebar-status-val">Hoạt động ổn định</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default AdminSidebar;
