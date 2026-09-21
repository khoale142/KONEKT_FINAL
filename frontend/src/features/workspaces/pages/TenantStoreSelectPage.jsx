import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, Plus, ArrowRight, ArrowLeft, Building2, MapPin, 
  Layers, Search, Bell, ChevronDown, LogOut, Shield 
} from 'lucide-react';
import { FadeLoader, ClipLoader } from 'react-spinners';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { apiClient } from '../../../services/apiClient.js';
import { ROUTES } from '../../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';

export function TenantStoreSelectPage() {
  const { workspace, selectWorkspace, user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [tenant, setTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Modal State
  const [showCreateStore, setShowCreateStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');

  const fetchTenantDetails = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/tenants/${workspace.id}`);
      setTenant(res.data);
      setError(null);
    } catch (err) {
      setError('Không thể tải thông tin thương hiệu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspace) {
      if (workspace.type === WORKSPACE_TYPES.TENANT) {
        fetchTenantDetails();
      } else if (workspace.type !== WORKSPACE_TYPES.STORE) {
        navigate(ROUTES.WORKSPACES);
      }
    }
  }, [workspace, navigate]);

  const handleSelectStore = async (storeId) => {
    try {
      setIsJoining(true);
      await selectWorkspace({ workspaceType: WORKSPACE_TYPES.STORE, workspaceId: storeId });
      window.location.assign(ROUTES.STORE_POS);
    } catch (err) {
      alert('Lỗi truy cập chi nhánh: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) return;
    try {
      setIsJoining(true);
      const res = await apiClient.post('/stores', { 
        name: storeName.trim(),
        address: storeAddress.trim()
      });
      setShowCreateStore(false);
      setStoreName('');
      setStoreAddress('');
      
      await selectWorkspace({ workspaceType: WORKSPACE_TYPES.STORE, workspaceId: res.data.id });
      window.location.assign(ROUTES.STORE_POS);
    } catch (err) {
      alert('Lỗi tạo chi nhánh: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  // Filtered store list
  const stores = tenant?.stores || [];
  const filteredStores = useMemo(() => {
    if (!searchTerm.trim()) return stores;
    const q = searchTerm.toLowerCase();
    return stores.filter(s => 
      (s.storeName || s.name || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    );
  }, [stores, searchTerm]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px', backgroundColor: '#F4EEE4' }}>
        <FadeLoader color="#48614a" />
        <p style={{ color: '#737971', fontWeight: '500', fontSize: '15px', marginTop: '12px' }}>Đang tải thông tin chi nhánh...</p>
      </div>
    );
  }

  const userInitial = user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'K';
  const userName = user?.fullName || user?.username || 'Khoa Le';
  const userEmail = user?.email || (user?.username ? `${user.username}@konekt.vn` : 'khoa.le@konekt.vn');
  const tenantNameUpper = (tenant?.name || 'THƯƠNG HIỆU').toUpperCase();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F4EEE4', color: '#1d1b16', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--font-family, "Be Vietnam Pro", "Plus Jakarta Sans", sans-serif)' }}>
      
      {/* BEGIN: TopBar (Persistent Top Bar) */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#48614a', color: '#FFFFFF', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Left: Back Navigation & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            <button 
              onClick={() => navigate(ROUTES.WORKSPACES)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                color: '#f0ffed', backgroundColor: 'transparent', border: 'none', padding: '6px 10px',
                borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: 'background-color 0.15s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ArrowLeft size={16} />
              <span>Quay lại không gian làm việc</span>
            </button>

            <span style={{ color: 'rgba(209, 250, 229, 0.4)' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', letterSpacing: '0.05em', fontWeight: '600', color: 'rgba(240, 255, 237, 0.85)', textTransform: 'uppercase' }}>
              <span>{tenantNameUpper}</span>
              <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
              <span style={{ color: '#FFFFFF' }}>CHỌN CHI NHÁNH</span>
            </div>
          </div>

          {/* Center: Quick Search Input */}
          <div style={{ flex: 1, maxWidth: '320px', margin: '0 8px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', top: 0, bottom: 0, left: '11px', display: 'flex', alignItems: 'center', color: '#48614a', pointerEvents: 'none' }}>
                <Search size={15} />
              </span>
              <input 
                type="text" 
                placeholder="Tìm chi nhánh, cửa hàng..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '7px 12px 7px 34px', backgroundColor: '#F4EEE4',
                  color: '#1d1b16', fontSize: '13px', borderRadius: '10px', border: '1px solid rgba(195, 200, 191, 0.7)',
                  outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
                }}
                onFocus={(e) => {
                  e.target.style.backgroundColor = '#FFFFFF';
                  e.target.style.borderColor = '#48614a';
                }}
                onBlur={(e) => {
                  e.target.style.backgroundColor = '#F4EEE4';
                  e.target.style.borderColor = 'rgba(195, 200, 191, 0.7)';
                }}
              />
            </div>
          </div>

          {/* Right: User Avatar & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Notification Bell */}
            <button 
              type="button" 
              title="Thông báo"
              style={{ padding: '8px', color: 'rgba(255, 255, 255, 0.85)', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Bell size={18} />
              <span style={{ position: 'absolute', top: '7px', right: '7px', width: '8px', height: '8px', backgroundColor: '#34d399', borderRadius: '50%', boxShadow: '0 0 0 2px #48614a' }}></span>
            </button>

            {/* User Profile Pill */}
            <div style={{ position: 'relative' }}>
              <button 
                type="button" 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  padding: '4px 10px 4px 6px', borderRadius: '999px', border: '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer', color: '#FFFFFF', transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FFFFFF', color: '#48614a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                    {userInitial}
                  </div>
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', backgroundColor: '#34d399', borderRadius: '50%', boxShadow: '0 0 0 1.5px #48614a' }}></span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#FFFFFF', lineHeight: 1.1 }}>{userName}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.1 }}>{userEmail}</span>
                </div>
                <ChevronDown size={14} style={{ color: 'rgba(255, 255, 255, 0.75)', marginLeft: '2px' }} />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '220px',
                  backgroundColor: '#FFFFFF', borderRadius: '14px', boxShadow: '0 12px 28px rgba(72, 97, 74, 0.15)',
                  border: '1px solid rgba(195, 200, 191, 0.8)', padding: '6px 0', zIndex: 50, color: '#1d1b16'
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f4eee4' }}>
                    <div style={{ fontWeight: 'bold', color: '#1d1b16', fontSize: '13px' }}>{userName}</div>
                    <div style={{ fontSize: '11px', color: '#737971', marginTop: '2px' }}>{userEmail}</div>
                  </div>
                  <div style={{ padding: '4px 0' }}>
                    <button 
                      onClick={handleLogout}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', backgroundColor: 'transparent', border: 'none',
                        color: '#ba1a1a', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffdad6'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>
      {/* END: TopBar */}

      {/* BEGIN: MainContent */}
      <main style={{ flex: 1, maxWidth: '1152px', width: '100%', margin: '0 auto', padding: '36px 16px', boxSizing: 'border-box' }}>
        
        {/* Page Header Section */}
        <section style={{ marginBottom: '32px' }}>
          {/* Sub-label with Hierarchy Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#48614a', fontWeight: '600', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
            <Layers size={16} style={{ color: '#48614a' }} />
            <span>HỆ THỐNG PHÂN CẤP CHUỖI</span>
          </div>

          {/* Main Title & Add Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1d1b16', margin: 0, letterSpacing: '-0.02em' }}>
                {tenant?.name || 'Thương hiệu'}
              </h1>
              <p style={{ fontSize: '15px', color: '#737971', margin: '6px 0 0 0', maxWidth: '560px' }}>
                Chọn chi nhánh cửa hàng để làm việc
              </p>
            </div>

            {/* Badges & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: '600', backgroundColor: '#e7efe4', color: '#48614a', border: '1px solid rgba(72, 97, 74, 0.15)' }}>
                Tổng cộng: {stores.length} Chi nhánh
              </span>
              <button 
                onClick={() => setShowCreateStore(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px',
                  backgroundColor: '#48614a', color: '#FFFFFF', fontSize: '14px', fontWeight: '600',
                  borderRadius: '12px', border: 'none', boxShadow: '0 2px 6px rgba(72, 97, 74, 0.25)',
                  cursor: 'pointer', transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#384d3a'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#48614a'}
              >
                <Plus size={16} />
                <span>Thêm chi nhánh</span>
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div style={{ padding: '16px', backgroundColor: '#ffdad6', color: '#93000a', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        {/* HQ Management Card (Quản lý toàn bộ chuỗi) */}
        <section style={{ marginBottom: '36px' }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(195, 200, 191, 0.6)',
            boxShadow: '0 4px 20px -2px rgba(61, 80, 60, 0.05)', padding: '24px', position: 'relative',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '20px', transition: 'border-color 0.2s'
          }}>
            {/* Left Brand Accent Line */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: '#48614a' }}></div>

            {/* Info Area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', paddingLeft: '8px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#e7efe4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#48614a' }}>
                <Building2 size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1d1b16', margin: 0 }}>Quản lý toàn bộ chuỗi</h2>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(72, 97, 74, 0.1)', color: '#48614a', border: '1px solid rgba(72, 97, 74, 0.2)' }}>
                    HQ VIEW
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#737971', margin: '4px 0 0 0', maxWidth: '580px', lineHeight: '1.4' }}>
                  Xem tổng hợp số liệu toàn bộ chi nhánh, quản lý danh mục, kho tổng và cấu hình chính sách chung.
                </p>
              </div>
            </div>

            {/* HQ Action CTA */}
            <div>
              <button 
                onClick={() => navigate(ROUTES.OWNER_DASHBOARD)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                  backgroundColor: '#48614a', color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
                  borderRadius: '12px', border: 'none', boxShadow: '0 2px 6px rgba(72, 97, 74, 0.2)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#384d3a';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#48614a';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <span>Vào bảng điều hành chuỗi</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Branch List Section */}
        <section>
          {/* Section Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d1b16', fontWeight: 'bold', fontSize: '17px', marginBottom: '18px' }}>
            <span style={{ color: '#48614a', fontSize: '18px', lineHeight: 1 }}>•</span>
            <h2>Danh sách chi nhánh cửa hàng</h2>
          </div>

          {/* Branch Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
            {filteredStores.map(store => (
              <div 
                key={store.storeId || store.id}
                onClick={() => !isJoining && handleSelectStore(store.storeId || store.id)}
                style={{
                  backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(195, 200, 191, 0.6)',
                  padding: '22px', boxShadow: '0 4px 20px -2px rgba(61, 80, 60, 0.05)', display: 'flex',
                  flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.2s ease',
                  cursor: isJoining ? 'wait' : 'pointer'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#48614a';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 24px -4px rgba(72, 97, 74, 0.12)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(195, 200, 191, 0.6)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(61, 80, 60, 0.05)';
                }}
              >
                <div>
                  {/* Header of Card */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Storefront Icon */}
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#e7efe4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#48614a' }}>
                        <Store size={22} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontWeight: 'bold', color: '#1d1b16', fontSize: '16px' }}>
                          {store.storeName || store.name}
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#737971', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} style={{ color: '#48614a', flexShrink: 0 }} />
                          <span>{store.address || 'Chưa cập nhật địa chỉ'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', flexShrink: 0 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                      <span>Đang hoạt động</span>
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'rgba(195, 200, 191, 0.4)', margin: '16px 0' }}></div>

                {/* Card Footer Action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                  <span style={{ fontSize: '12px', color: '#737971', fontWeight: '500' }}>KONEKT POS System</span>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                    backgroundColor: '#48614a', color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
                    borderRadius: '10px', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                  }}>
                    <span>Vào cửa hàng</span>
                    <ArrowRight size={15} />
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Branch Placeholder Card (Dashed) */}
            <div 
              onClick={() => setShowCreateStore(true)}
              style={{
                border: '2px dashed rgba(195, 200, 191, 0.8)', borderRadius: '16px', padding: '24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease',
                backgroundColor: 'rgba(255, 255, 255, 0.45)', minHeight: '140px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#48614a';
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(195, 200, 191, 0.8)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.45)';
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: '1px solid rgba(195, 200, 191, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#48614a', marginBottom: '8px' }}>
                <Plus size={20} />
              </div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1d1b16' }}>Mở thêm chi nhánh mới</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#737971' }}>
                Mở rộng mạng lưới phân phối cho thương hiệu {tenant?.name || ''}
              </p>
            </div>

          </div>
        </section>

      </main>
      {/* END: MainContent */}

      {/* BEGIN: Footer */}
      <footer style={{ borderTop: '1px solid rgba(195, 200, 191, 0.6)', padding: '24px 16px', color: '#737971', fontSize: '12px', fontWeight: '500' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ margin: 0 }}>© 2025 KONEKT POS. Toàn bộ quyền được bảo lưu.</p>
          <div style={{ color: '#737971' }}>
            <span>Hệ điều hành bán hàng đa kênh chuyên sâu</span>
          </div>
        </div>
      </footer>
      {/* END: Footer */}

      {/* Modal: Create Store */}
      {showCreateStore && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(29, 27, 22, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: 'bold', color: '#1d1b16' }}>Tạo chi nhánh mới</h2>
            <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1d1b16' }}>Tên chi nhánh <span style={{color:'#ba1a1a'}}>*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="VD: Chi nhánh Quận 1"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={isJoining}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #c3c8bf', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1d1b16' }}>Địa chỉ</label>
                <input 
                  type="text" 
                  placeholder="VD: 123 Nguyễn Huệ, Bến Nghé"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  disabled={isJoining}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #c3c8bf', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateStore(false)} 
                  disabled={isJoining} 
                  style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', backgroundColor: '#f4eee4', color: '#434842', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isJoining} 
                  style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', backgroundColor: '#48614a', color: '#FFFFFF', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isJoining ? (
                    <>
                      <ClipLoader color="#FFFFFF" size={16} />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    'Tạo & Vào làm việc'
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
