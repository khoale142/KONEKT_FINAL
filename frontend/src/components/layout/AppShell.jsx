import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';

const adminMenu = [
  { label: 'Dashboard', status: 'Ready' },
  { label: 'Products', status: 'Next' },
  { label: 'Ingredients', status: 'Next' },
  { label: 'Stock', status: 'Next' },
  { label: 'Recipes', status: 'Next' },
  { label: 'Reports', status: 'Next' },
];

const staffMenu = [
  { label: 'Dashboard', status: 'Ready' },
  { label: 'POS Order', status: 'Next' },
  { label: 'Order History', status: 'Next' },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const menu = user?.role === 'ADMIN' ? adminMenu : staffMenu;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">MC</div>
          <div>
            <h1>Mini Coffee</h1>
            <p>POS & Inventory</p>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {menu.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.status === 'Ready' ? 'nav-item active' : 'nav-item disabled'}
              disabled={item.status !== 'Ready'}
              title={item.status === 'Ready' ? item.label : 'Sẽ làm ở task sau'}
            >
              <span>{item.label}</span>
              <small>{item.status}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="shell-main">
        <header className="topbar">
          <div>
            <h2>Xin chào, {user?.fullName || user?.username}</h2>
          </div>
          <div className="topbar-actions">
            <span className="role-pill">{user?.role}</span>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
