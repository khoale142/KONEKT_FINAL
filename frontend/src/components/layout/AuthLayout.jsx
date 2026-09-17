
export function AuthLayout({ children }) {
  return (
    <div className="auth-container">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="brand-mark" style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'var(--color-surface-container-lowest)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            fontSize: '26px',
            marginBottom: 'var(--spacing-lg)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            animation: 'floatAnimation 4s ease-in-out infinite',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>MC</div>
          <h1 className="display-lg" style={{ 
            color: 'var(--color-on-primary)', 
            fontWeight: '800', 
            fontSize: '38px',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
            marginBottom: '16px', 
            margin: 0,
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            Mini Coffee POS
          </h1>
          <p className="body-lg" style={{ 
            color: 'rgba(255, 255, 255, 0.85)', 
            lineHeight: '1.7', 
            fontSize: '16px',
            marginTop: '12px', 
            margin: 0,
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            Hệ thống quản lý bán hàng và tồn kho thông minh dành cho cửa hàng cà phê. Kiểm soát chặt chẽ nguyên liệu, sản phẩm, và tối ưu quy trình vận hành.
          </p>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
}
export default AuthLayout;
