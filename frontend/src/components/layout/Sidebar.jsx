import { useEffect, useState, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  UserCheck,
  ChefHat,
  History,
  Coffee,
  Package,
  BarChart3,
  Calendar,
  Users,
  ShieldCheck,
  ChevronsLeft,
  Store,
  LogOut,
} from 'lucide-react';
import { ROUTES } from '../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../constants/roles.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { apiClient } from '../../services/apiClient.js';
import './Sidebar.css';

export function Sidebar({ isCollapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace } = useAuth();

  // Store information state
  const [storeInfo, setStoreInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('konekt_current_store');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Fetch store details to get real store name and branch address
  useEffect(() => {
    if (workspace?.type === WORKSPACE_TYPES.STORE && workspace.id) {
      apiClient
        .get('/workspaces')
        .then((res) => {
          const data = res.data;
          if (!data) return;

          let found = data.staffStores?.find((s) => s.id === workspace.id);
          if (!found && data.ownedTenants) {
            for (const t of data.ownedTenants) {
              const match = t.stores?.find((s) => s.id === workspace.id);
              if (match) {
                found = { ...match, tenant_name: t.name };
                break;
              }
            }
          }
          if (found) {
            setStoreInfo(found);
            localStorage.setItem('konekt_current_store', JSON.stringify(found));
          }
        })
        .catch(() => {});
    }
  }, [workspace?.id, workspace?.type]);

  // Derived store name and branch
  const storeName = useMemo(() => {
    if (storeInfo?.name) return storeInfo.name;
    if (workspace?.storeName) return workspace.storeName;
    return 'Mộc Coffee & Tea';
  }, [storeInfo?.name, workspace?.storeName]);

  const storeBranch = useMemo(() => {
    if (storeInfo?.address) return storeInfo.address;
    if (storeInfo?.branch) return storeInfo.branch;
    return 'CN Quận 1';
  }, [storeInfo?.address, storeInfo?.branch]);

  const storeInitials = useMemo(() => {
    const parts = storeName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return storeName.slice(0, 2).toUpperCase() || 'MC';
  }, [storeName]);

  const isManager = workspace?.role === 'MANAGER' || workspace?.type === WORKSPACE_TYPES.TENANT;

  // Menu Groups for Store Workspace matching latest design & permissions
  const storeSections = useMemo(() => {
    if (!isManager) {
      return [
        {
          title: 'VẬN HÀNH BÁN HÀNG',
          counter: '01',
          items: [
            {
              label: 'Bán hàng (POS)',
              path: ROUTES.STORE_POS,
              icon: <ShoppingCart size={19} />,
            },
            {
              label: 'Quản lý ca làm',
              path: ROUTES.STORE_SESSION,
              icon: <UserCheck size={19} />,
            },
            {
              label: 'KDS / Bếp',
              path: ROUTES.STORE_KDS,
              icon: <ChefHat size={19} />,
            },
          ],
        },
        {
          title: 'KHO HÀNG',
          counter: '02',
          items: [
            {
              label: 'Nhập kho & Kiểm kê',
              path: ROUTES.STORE_STOCK,
              icon: <Package size={19} />,
            },
          ],
        },
        {
          title: 'NHÂN SỰ & CHẤM CÔNG',
          counter: '03',
          items: [
            {
              label: 'Chấm công GPS',
              path: ROUTES.STORE_HR_ATTENDANCE,
              icon: <ShieldCheck size={19} />,
            },
            {
              label: 'Lịch làm & Lương của tôi',
              path: ROUTES.STORE_HR,
              icon: <Calendar size={19} />,
            },
          ],
        },
      ];
    }

    return [
      {
        title: 'VẬN HÀNH BÁN HÀNG',
        counter: '01',
        items: [
          {
            label: 'Bảng điều khiển',
            path: '/store/dashboard',
            icon: <LayoutDashboard size={19} />,
          },
          {
            label: 'Bán hàng (POS)',
            path: ROUTES.STORE_POS,
            icon: <ShoppingCart size={19} />,
          },
          {
            label: 'Quản lý ca làm',
            path: ROUTES.STORE_SESSION,
            icon: <UserCheck size={19} />,
          },
          {
            label: 'KDS / Bếp',
            path: ROUTES.STORE_KDS,
            icon: <ChefHat size={19} />,
          },
        ],
      },
      {
        title: 'KHO & THỰC ĐƠN',
        counter: '02',
        items: [
          {
            label: 'Lịch sử đơn hàng',
            path: ROUTES.STORE_ORDERS,
            icon: <History size={19} />,
          },
          {
            label: 'Sản phẩm & Menu',
            path: ROUTES.STORE_CATALOG,
            icon: <Coffee size={19} />,
          },
          {
            label: 'Nhập kho & Kiểm kê',
            path: ROUTES.STORE_STOCK,
            icon: <Package size={19} />,
          },
        ],
      },
      {
        title: 'BÁO CÁO & ĐỘI NGŨ',
        counter: '03',
        items: [
          {
            label: 'Báo cáo doanh thu',
            path: '/store/reports',
            icon: <BarChart3 size={19} />,
          },
          {
            label: 'Lịch làm nhân sự',
            path: '/store/manager-hr/calendar',
            icon: <Calendar size={19} />,
          },
          {
            label: 'Quản lý nhân sự',
            path: '/store/manager-hr',
            icon: <Users size={19} />,
          },
          {
            label: 'Chấm công GPS',
            path: ROUTES.STORE_HR_ATTENDANCE,
            icon: <ShieldCheck size={19} />,
          },
        ],
      },
    ];
  }, [isManager]);

  // Owner / Tenant Menu
  const ownerSections = [
    {
      title: 'QUẢN TRỊ DOANH NGHIỆP',
      counter: '01',
      items: [
        {
          label: 'Quản lý Chi nhánh',
          path: ROUTES.OWNER_STORES,
          icon: <Store size={19} />,
        },
      ],
    },
  ];

  const sections = workspace?.type === WORKSPACE_TYPES.TENANT ? ownerSections : storeSections;
  const isStore = workspace?.type === WORKSPACE_TYPES.STORE;

  const isLinkActive = (itemPath) => {
    const currentPath = location.pathname;
    const itemPathname = itemPath.split('?')[0];

    if (itemPathname === currentPath) return true;

    if (itemPathname === ROUTES.STORE_CATALOG) {
      if (
        currentPath.startsWith('/store/catalog') ||
        currentPath.startsWith('/store/products') ||
        currentPath.startsWith('/store/ingredients') ||
        currentPath.startsWith('/store/recipes')
      ) {
        return true;
      }
    }

    if (itemPathname === ROUTES.STORE_STOCK.split('?')[0]) {
      if (currentPath.startsWith('/store/stock')) return true;
    }

    if (itemPathname === '/store/manager-hr') {
      if (currentPath.startsWith('/store/manager-hr') && !currentPath.includes('/calendar')) {
        return true;
      }
    }

    if (itemPathname === ROUTES.STORE_ORDERS) {
      if (currentPath.startsWith('/store/orders')) return true;
    }

    return false;
  };

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-box">
          <div
            className="sidebar-avatar-wrapper"
            onClick={isCollapsed ? onToggle : undefined}
            title={isCollapsed ? 'Nhấn vào logo để mở rộng menu' : undefined}
            role={isCollapsed ? 'button' : undefined}
            tabIndex={isCollapsed ? 0 : undefined}
            onKeyDown={(e) => {
              if (isCollapsed && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onToggle();
              }
            }}
          >
            {storeInitials}
            <span className="sidebar-avatar-status"></span>
          </div>

          {!isCollapsed && (
            <div className="sidebar-brand-info">
              <h1 className="sidebar-brand-name" title={storeName}>
                {storeName}
              </h1>
              <p className="sidebar-brand-sub" title={storeBranch}>
                {storeBranch}
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggle}
            title="Thu gọn menu"
            aria-label="Thu gọn menu"
          >
            <ChevronsLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation Scroll Area */}
      <nav className="sidebar-nav-scroll" aria-label="Main sidebar navigation">
        {sections.map((sec) => (
          <div key={sec.title} className="sidebar-group">
            {!isCollapsed && (
              <div className="sidebar-group-header">
                <span className="sidebar-group-title">{sec.title}</span>
                <span className="sidebar-group-counter">{sec.counter}</span>
              </div>
            )}

            {sec.items.map((item) => {
              const active = isLinkActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`sidebar-nav-item ${active ? 'is-active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="sidebar-nav-item-content">
                    <span className="sidebar-nav-item-icon">{item.icon}</span>
                    {!isCollapsed && (
                      <span className="sidebar-nav-item-text">{item.label}</span>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Shift Card in dedicated Footer (Ca làm việc) */}
      {isStore && !isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-shift-card">
            <div className="sidebar-shift-status-row">
              <div className="sidebar-shift-info">
                <span className="sidebar-shift-dot is-open"></span>
                <span>Ca sáng: 06:30 – 14:30</span>
              </div>
              <span className="sidebar-shift-pill is-open">ĐANG MỞ</span>
            </div>

            <button
              type="button"
              className="sidebar-shift-action-btn"
              onClick={() => navigate(ROUTES.STORE_SESSION)}
              title="Quản lý ca làm việc"
            >
              <LogOut size={14} />
              <span>Chốt ca &amp; Bàn giao</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
