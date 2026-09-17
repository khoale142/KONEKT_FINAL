import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Coffee,
  Milk,
  Package,
  ChefHat,
  BarChart3,
  ShoppingCart,
  History,
  Users,
  Calendar,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Store
} from 'lucide-react';
import { ROUTES } from '../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../constants/roles.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';

export function Sidebar({ isCollapsed, onToggle }) {
  const location = useLocation();
  const { workspace } = useAuth();

  const ownerMenu = [
    { label: 'Bảng điều khiển', path: ROUTES.OWNER_DASHBOARD, icon: <LayoutDashboard size={21} /> },
    { label: 'Quản lý Chi nhánh', path: ROUTES.OWNER_STORES, icon: <Store size={21} /> },
    { label: 'Sản phẩm & Công thức', path: ROUTES.OWNER_PRODUCTS, icon: <Coffee size={21} /> },
    { label: 'Quản lý nguyên liệu', path: ROUTES.OWNER_INGREDIENTS, icon: <Milk size={21} /> },
    { label: 'Báo cáo thống kê', path: ROUTES.OWNER_REPORTS, icon: <BarChart3 size={21} /> },
    { label: 'Lịch làm nhân sự', path: '/owner/hr/calendar', icon: <Calendar size={21} /> },
    { label: 'Quản lý nhân sự', path: '/owner/hr', icon: <Users size={21} /> },
    { label: 'Chấm công nhân sự', path: ROUTES.OWNER_HR_ATTENDANCE, icon: <UserCheck size={21} /> },
  ];

  const storeMenu = [
    { label: 'Bán hàng (POS)', path: ROUTES.STORE_POS, icon: <ShoppingCart size={21} /> },
    { label: 'Quản lý ca làm', path: ROUTES.STORE_SESSION, icon: <UserCheck size={21} /> },
    { label: 'KDS / Bếp', path: ROUTES.STORE_KDS, icon: <ChefHat size={21} /> }, 
    { label: 'Lịch sử đơn hàng', path: ROUTES.STORE_ORDERS, icon: <History size={21} /> },
    { label: 'Nhập kho & Kiểm kê', path: ROUTES.STORE_STOCK, icon: <Package size={21} /> },
    { label: 'Nhân sự & Lịch làm', path: '/store/hr', icon: <Calendar size={21} /> },
    { label: 'Chấm công', path: ROUTES.STORE_HR_ATTENDANCE, icon: <UserCheck size={21} /> },
  ];

  // If user is owner of the current store, they might want to see more links, but let's keep it simple: 
  // Owner uses /owner/* for global store configs, and /store/* for operational stuff.
  const menu = workspace?.type === WORKSPACE_TYPES.TENANT ? ownerMenu : storeMenu;

  const isLinkActive = (itemPath) => {
    const currentPath = location.pathname;
    const itemPathname = itemPath.split('?')[0];

    if (itemPathname === currentPath) return true;
    
    // Check main parent highlights for subroutes
    if (itemPathname === ROUTES.OWNER_PRODUCTS.split('?')[0]) {
      if (currentPath.startsWith('/owner/products') || currentPath.startsWith('/owner/recipes')) {
        return true;
      }
    }

    if (itemPathname === ROUTES.OWNER_INGREDIENTS.split('?')[0]) {
      if (currentPath.startsWith('/owner/ingredients')) {
        return true;
      }
    }

    if (itemPathname === ROUTES.STORE_STOCK.split('?')[0]) {
      if (currentPath.startsWith('/store/stock')) {
        return true;
      }
    }

    if (itemPathname === '/owner/hr') {
      if (currentPath.startsWith('/owner/users') || currentPath.startsWith('/owner/hr')) {
        return true;
      }
    }

    if (itemPathname === ROUTES.STORE_ORDERS) {
      if (currentPath.startsWith('/store/orders')) {
        return true;
      }
    }
    
    return false;
  };

  const getBrandText = () => {
    if (!workspace) return 'Mini Coffee';
    if (workspace.type === WORKSPACE_TYPES.TENANT) return workspace.tenantName || 'Thương hiệu';
    if (workspace.type === WORKSPACE_TYPES.STORE) return workspace.storeName || 'Cửa hàng';
    return 'Mini Coffee';
  };

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">MC</div>
        <div className="sidebar-brand-text">
          <h1 className="sidebar-brand-title">{getBrandText()}</h1>
          <p className="sidebar-brand-subtitle">POS & Inventory</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menu.map((item) => {
          const isActive = isLinkActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-nav-link${isActive ? ' is-active' : ''}`}
              data-tooltip={item.label}
            >
              {item.icon}
              <span className="sidebar-nav-link-text">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-toggle-container">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          type="button"
          data-tooltip={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          <span className="sidebar-toggle-btn-text">Thu gọn menu</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
