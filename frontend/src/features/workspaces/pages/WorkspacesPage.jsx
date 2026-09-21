import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Store, Plus, UserPlus, LogOut, ArrowRight, 
  Search, Bell, ChevronDown, Check 
} from 'lucide-react';
import { FadeLoader } from 'react-spinners';
import { useAuth } from '../../../app/providers/AuthProvider.jsx';
import { apiClient } from '../../../services/apiClient.js';
import { ROUTES } from '../../../constants/routes.js';
import { WORKSPACE_TYPES } from '../../../constants/roles.js';

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState({ ownedTenants: [], staffStores: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Modals state
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showJoinStore, setShowJoinStore] = useState(false);
  
  // Form state
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const { user, selectWorkspace, logout } = useAuth();
  const navigate = useNavigate();

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/workspaces');
      setWorkspaces(res.data || { ownedTenants: [], staffStores: [] });
      setError(null);
    } catch (err) {
      setError('Không thể tải danh sách nơi làm việc.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleSelectWorkspace = async (type, id) => {
    try {
      setIsJoining(true);
      await selectWorkspace({ workspaceType: type, workspaceId: id });
      if (type === WORKSPACE_TYPES.TENANT) {
        navigate('/owner/select-store');
      } else {
        window.location.assign(ROUTES.STORE_POS);
      }
    } catch (err) {
      alert('Lỗi khi truy cập: ' + (err.message || 'Không xác định'));
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!tenantName.trim()) return;
    try {
      setIsJoining(true);
      const res = await apiClient.post('/tenants', { 
        name: tenantName.trim(),
        email: tenantEmail.trim(),
        phone: tenantPhone.trim()
      });
      setShowCreateTenant(false);
      setTenantName('');
      setTenantEmail('');
      setTenantPhone('');
      
      await handleSelectWorkspace(WORKSPACE_TYPES.TENANT, res.data.id);
    } catch (err) {
      alert('Lỗi tạo thương hiệu: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleJoinStore = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      setIsJoining(true);
      const res = await apiClient.post('/stores/join', { inviteCode: inviteCode.trim() });
      setShowJoinStore(false);
      setInviteCode('');
      
      await handleSelectWorkspace(WORKSPACE_TYPES.STORE, res.data.store.id);
    } catch (err) {
      alert('Lỗi tham gia: ' + (err.message || 'Không xác định'));
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  // Filtered & Sorted Tenants
  const filteredTenants = useMemo(() => {
    let list = [...(workspaces.ownedTenants || [])];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q));
    }
    if (sortBy === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'stores') {
      list.sort((a, b) => (b.stores?.length || 0) - (a.stores?.length || 0));
    }
    return list;
  }, [workspaces.ownedTenants, searchTerm, sortBy]);

  // Filtered Staff Stores
  const filteredStaffStores = useMemo(() => {
    let list = [...(workspaces.staffStores || [])];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(s => s.storeName?.toLowerCase().includes(q) || s.tenantName?.toLowerCase().includes(q));
    }
    return list;
  }, [workspaces.staffStores, searchTerm]);

  const sortOptions = [
    { id: 'recent', label: 'Mới truy cập gần đây' },
    { id: 'name', label: 'Tên A - Z' },
    { id: 'stores', label: 'Số lượng chi nhánh' }
  ];
  const currentSortLabel = sortOptions.find(o => o.id === sortBy)?.label || 'Mới truy cập gần đây';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px', backgroundColor: '#F4EEE4' }}>
        <FadeLoader color="#48614a" />
        <p style={{ color: '#737971', fontWeight: '600', fontSize: '15px', marginTop: '12px' }}>Đang tải danh sách không gian làm việc...</p>
      </div>
    );
  }

  const hasAnyWorkspace = workspaces.ownedTenants.length > 0 || workspaces.staffStores.length > 0;
  const userInitial = user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'K';
  const userName = user?.fullName || user?.username || 'Khoa Le';
  const userEmail = user?.email || (user?.username ? `${user.username}@konekt.vn` : 'khoa.le@konekt.vn');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F4EEE4', color: '#1d1b16', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'var(--font-family, "Plus Jakarta Sans", sans-serif)' }}>
      
      {/* BEGIN: MainHeader (Olive Green #48614a) */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#48614a', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '0 16px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Brand & Section Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate(ROUTES.WORKSPACES)}>
              <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
                <Building2 size={20} />
              </div>
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: '#FFFFFF' }}>KONEKT</span>
            </div>
            
            <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}></div>
            
            <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f0ffed', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Chọn không gian làm việc
            </span>
          </div>

          {/* Right Navigation Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* Quick Search */}
            <div style={{ position: 'relative', width: '240px' }}>
              <span style={{ position: 'absolute', top: 0, bottom: 0, left: '11px', display: 'flex', alignItems: 'center', color: '#48614a', pointerEvents: 'none' }}>
                <Search size={15} />
              </span>
              <input 
                type="text" 
                placeholder="Tìm chuỗi, chi nhánh..." 
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

            {/* Notifications Bell */}
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
      {/* END: MainHeader */}

      {/* BEGIN: MainContent */}
      <main style={{ flex: 1, maxWidth: '1024px', width: '100%', margin: '0 auto', padding: '40px 16px', boxSizing: 'border-box' }}>
        
        {/* Top Action Bar: Greeting & Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#1d1b16', margin: 0, letterSpacing: '-0.02em' }}>
              Xin chào, {userName}
            </h1>
            <p style={{ fontSize: '14px', color: '#737971', margin: '6px 0 0 0' }}>
              Chọn một thương hiệu để bắt đầu làm việc
            </p>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              type="button"
              onClick={() => setShowJoinStore(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                borderRadius: '12px', border: '1px solid rgba(72, 97, 74, 0.25)', backgroundColor: '#FFFFFF',
                color: '#48614a', fontWeight: '600', fontSize: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e7efe4'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              <UserPlus size={16} style={{ color: '#48614a' }} />
              Tham gia bằng mã mời
            </button>

            <button 
              type="button"
              onClick={() => setShowCreateTenant(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                borderRadius: '12px', border: 'none', backgroundColor: '#48614a',
                color: '#FFFFFF', fontWeight: '600', fontSize: '14px', boxShadow: '0 2px 6px rgba(72, 97, 74, 0.25)',
                cursor: 'pointer', transition: 'background-color 0.15s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#384d3a'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#48614a'}
            >
              <Plus size={16} />
              Tạo thương hiệu mới
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '16px', backgroundColor: '#ffdad6', color: '#93000a', borderRadius: '12px', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        {/* SECTION: Chuỗi của bạn (Quản trị viên) */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#48614a' }}></span>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1d1b16', margin: 0 }}>
                Chuỗi của bạn <span style={{ fontWeight: '400', color: '#737971' }}>(Quản trị viên)</span>
              </h2>
              <span style={{ backgroundColor: '#e7efe4', color: '#48614a', fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', marginLeft: '4px' }}>
                {workspaces.ownedTenants.length} chuỗi hoạt động
              </span>
            </div>

            {workspaces.ownedTenants.length > 0 && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#737971' }}>
                <span>Sắp xếp theo:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '5px 12px', borderRadius: '8px',
                      backgroundColor: '#FFFFFF', border: '1px solid rgba(195, 200, 191, 0.75)',
                      color: '#1d1b16', fontWeight: '600', fontSize: '13px',
                      cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#48614a';
                      e.currentTarget.style.backgroundColor = '#faf8f5';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(195, 200, 191, 0.75)';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    <span>{currentSortLabel}</span>
                    <ChevronDown size={14} style={{ color: '#48614a', transform: showSortMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>

                  {showSortMenu && (
                    <>
                      <div 
                        onClick={() => setShowSortMenu(false)} 
                        style={{ position: 'fixed', inset: 0, zIndex: 45 }} 
                      />
                      <div style={{
                        position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '200px',
                        backgroundColor: '#FFFFFF', borderRadius: '12px',
                        boxShadow: '0 10px 28px rgba(72, 97, 74, 0.16), 0 4px 12px rgba(0,0,0,0.06)',
                        border: '1px solid rgba(195, 200, 191, 0.75)', padding: '6px', zIndex: 50
                      }}>
                        {sortOptions.map((opt) => {
                          const isSelected = sortBy === opt.id;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => {
                                setSortBy(opt.id);
                                setShowSortMenu(false);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                                fontWeight: isSelected ? '700' : '500',
                                color: isSelected ? '#48614a' : '#1d1b16',
                                backgroundColor: isSelected ? '#e7efe4' : 'transparent',
                                cursor: 'pointer', transition: 'background-color 0.15s'
                              }}
                              onMouseOver={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#f4eee4';
                              }}
                              onMouseOut={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <span>{opt.label}</span>
                              {isSelected && <Check size={15} style={{ color: '#48614a' }} />}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Workspace Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredTenants.map((tenant) => (
              <article 
                key={tenant.id}
                onClick={() => !isJoining && handleSelectWorkspace(WORKSPACE_TYPES.TENANT, tenant.id)}
                style={{
                  position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '16px',
                  border: '1px solid rgba(195, 200, 191, 0.5)', boxShadow: '0 2px 10px -2px rgba(72, 97, 74, 0.05)',
                  padding: '20px', overflow: 'hidden', cursor: isJoining ? 'wait' : 'pointer',
                  transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(72, 97, 74, 0.12)';
                  e.currentTarget.style.borderColor = '#48614a';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 10px -2px rgba(72, 97, 74, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(195, 200, 191, 0.5)';
                }}
              >
                {/* Left accent bar */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: '#48614a' }}></div>
                
                {/* Left: Icon & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingLeft: '8px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F4EEE4', border: '1px solid rgba(195, 200, 191, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#48614a', flexShrink: 0 }}>
                    <Store size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1d1b16' }}>{tenant.name}</h3>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#48614a', color: '#FFFFFF', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        CHỦ CHUỖI
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#737971' }}>
                      Quản lý {tenant.stores?.length || 0} chi nhánh
                    </p>
                  </div>
                </div>

                {/* Right: Action Button */}
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#F4EEE4',
                    color: '#48614a', fontWeight: '600', fontSize: '13px', padding: '8px 16px',
                    borderRadius: '12px', border: '1px solid rgba(195, 200, 191, 0.6)', transition: 'all 0.15s'
                  }}>
                    <span>Truy cập</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </article>
            ))}

            {/* Dashed Box: Mở thêm thương hiệu mới */}
            <div 
              onClick={() => setShowCreateTenant(true)}
              style={{
                border: '2px dashed rgba(195, 200, 191, 0.8)', backgroundColor: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '16px', padding: '18px 20px', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#48614a';
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(195, 200, 191, 0.8)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#F4EEE4', border: '1px solid rgba(195, 200, 191, 0.6)', color: '#48614a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1d1b16' }}>Mở thêm thương hiệu mới</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#737971' }}>Thiết lập chuỗi cửa hàng hoặc chi nhánh kinh doanh tiếp theo</p>
                </div>
              </div>

              <button 
                type="button" 
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                  borderRadius: '12px', backgroundColor: '#48614a', color: '#FFFFFF',
                  fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer', flexShrink: 0
                }}
              >
                <Plus size={16} />
                <span>Tạo thương hiệu mới</span>
              </button>
            </div>

          </div>
        </div>

        {/* SECTION: Chi nhánh bạn tham gia (Nhân viên) */}
        {workspaces.staffStores.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#607a61' }}></span>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1d1b16', margin: 0 }}>
                Chi nhánh bạn tham gia <span style={{ fontWeight: '400', color: '#737971' }}>(Nhân viên)</span>
              </h2>
              <span style={{ backgroundColor: '#e7efe4', color: '#48614a', fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', marginLeft: '4px' }}>
                {workspaces.staffStores.length} chi nhánh
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredStaffStores.map((store) => (
                <article 
                  key={store.id}
                  onClick={() => !isJoining && handleSelectWorkspace(WORKSPACE_TYPES.STORE, store.id)}
                  style={{
                    position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '16px',
                    border: '1px solid rgba(195, 200, 191, 0.5)', boxShadow: '0 2px 10px -2px rgba(72, 97, 74, 0.05)',
                    padding: '20px', overflow: 'hidden', cursor: isJoining ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(72, 97, 74, 0.12)';
                    e.currentTarget.style.borderColor = '#48614a';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px -2px rgba(72, 97, 74, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(195, 200, 191, 0.5)';
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: '#607a61' }}></div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingLeft: '8px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F4EEE4', border: '1px solid rgba(195, 200, 191, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#48614a', flexShrink: 0 }}>
                      <Store size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1d1b16' }}>{store.storeName}</h3>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: '#607a61', color: '#FFFFFF', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          NHÂN VIÊN
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#737971' }}>
                        {store.tenantName} • {store.address || 'Chưa cập nhật địa chỉ'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#F4EEE4',
                      color: '#48614a', fontWeight: '600', fontSize: '13px', padding: '8px 16px',
                      borderRadius: '12px', border: '1px solid rgba(195, 200, 191, 0.6)'
                    }}>
                      <span>Vào làm việc</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

      </main>
      {/* END: MainContent */}

      {/* BEGIN: Minimal Footer */}
      <footer style={{ borderTop: '1px solid rgba(195, 200, 191, 0.5)', color: '#737971', padding: '24px 16px', fontSize: '12px', textAlign: 'center' }}>
        <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
          <span>© 2025 KONEKT POS. Toàn bộ quyền được bảo lưu.</span>
        </div>
      </footer>
      {/* END: Minimal Footer */}

      {/* Modal: Create Tenant */}
      {showCreateTenant && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(29, 27, 22, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: 'bold', color: '#1d1b16' }}>Tạo thương hiệu mới</h2>
            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1d1b16' }}>Tên thương hiệu <span style={{color:'#ba1a1a'}}>*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="VD: Chuỗi Cà Phê Highlands"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  disabled={isJoining}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #c3c8bf', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1d1b16' }}>Email liên hệ</label>
                <input 
                  type="email" 
                  placeholder="contact@brand.com"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  disabled={isJoining}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #c3c8bf', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1d1b16' }}>Số điện thoại</label>
                <input 
                  type="tel" 
                  placeholder="0912345678"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  disabled={isJoining}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #c3c8bf', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowCreateTenant(false)} disabled={isJoining} style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', backgroundColor: '#F4EEE4', color: '#48614a', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={isJoining} style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', backgroundColor: '#48614a', color: '#FFFFFF', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  {isJoining ? 'Đang tạo...' : 'Tạo thương hiệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Store */}
      {showJoinStore && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(29, 27, 22, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '12px', fontSize: '20px', fontWeight: 'bold', color: '#1d1b16' }}>Tham gia chi nhánh</h2>
            <p style={{ color: '#737971', fontSize: '14px', marginTop: 0, marginBottom: '20px' }}>Nhập mã mời từ quản lý cửa hàng để gia nhập đội ngũ.</p>
            <form onSubmit={handleJoinStore} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1d1b16' }}>Mã mời cửa hàng <span style={{color:'#ba1a1a'}}>*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="VD: ST-XXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  disabled={isJoining}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid #c3c8bf', outline: 'none', fontSize: '14px', boxSizing: 'border-box', letterSpacing: '0.05em' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowJoinStore(false)} disabled={isJoining} style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', backgroundColor: '#F4EEE4', color: '#48614a', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={isJoining} style={{ flex: 1, height: '42px', borderRadius: '8px', border: 'none', backgroundColor: '#48614a', color: '#FFFFFF', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  {isJoining ? 'Đang xác thực...' : 'Vào chi nhánh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
