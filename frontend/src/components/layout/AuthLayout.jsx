export function AuthLayout({ children, leftPanel, title, subtitle }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      backgroundColor: '#F4EEE4',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1152px',
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
        minHeight: '600px'
      }}>
        
        {/* Left Panel */}
        {leftPanel ? (
          leftPanel
        ) : (
          <section style={{
            width: '42%',
            padding: '48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            color: '#FFFFFF',
            backgroundColor: '#48614a'
          }}>
            <div style={{
              position: 'absolute',
              right: '-80px',
              top: '-80px',
              width: '320px',
              height: '320px',
              borderRadius: '50%',
              backgroundColor: 'rgba(96, 122, 97, 0.2)',
              filter: 'blur(40px)',
              pointerEvents: 'none'
            }}></div>
            <div style={{
              position: 'absolute',
              left: '-64px',
              bottom: '0',
              width: '256px',
              height: '256px',
              borderRadius: '50%',
              backgroundColor: 'rgba(75, 101, 77, 0.3)',
              filter: 'blur(24px)',
              pointerEvents: 'none'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>KONEKT</div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(4px)'
                }}>
                  POS & Inventory
                </span>
              </div>

              <div style={{ marginTop: '32px', marginBottom: '32px' }}>
                <h1 style={{
                  fontSize: '30px',
                  fontWeight: 'bold',
                  lineHeight: '1.3',
                  letterSpacing: '-0.02em',
                  marginBottom: '16px',
                  marginTop: 0
                }}>
                  {title || "Vận hành cửa hàng rõ ràng hơn."}
                </h1>
                {subtitle && (
                  <p style={{
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: '1.6',
                    maxWidth: '28rem',
                    margin: 0
                  }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Right Panel (Form) */}
        <section style={{
          width: '58%',
          padding: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9f3e9',
          position: 'relative'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            boxSizing: 'border-box',
            position: 'relative',
          }}>
            {children}
          </div>
        </section>

      </div>
    </div>
  );
}

export default AuthLayout;
