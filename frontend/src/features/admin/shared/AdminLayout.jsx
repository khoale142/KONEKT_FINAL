import { AdminSidebar } from './AdminSidebar.jsx';
import { AdminHeader } from './AdminHeader.jsx';
import './AdminLayout.css';

export function AdminLayout({ children }) {
  return (
    <div className="admin-layout-wrapper">
      <AdminSidebar />
      <AdminHeader />
      <main className="admin-main-content">
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;
