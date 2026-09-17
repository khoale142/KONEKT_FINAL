
export function Card({ title, value, subtext, icon, loading = false, className = '', children, ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children ? children : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {title}
            </span>
            {loading ? (
              <span className="headline-lg" style={{ color: 'var(--color-secondary)', margin: '4px 0', display: 'inline-block' }}>...</span>
            ) : (
              <span 
                className={String(value).length > 6 ? "headline-lg" : "display-lg"} 
                style={{ 
                  color: 'var(--color-primary)', 
                  fontWeight: '700', 
                  margin: '4px 0', 
                  display: 'inline-block',
                  whiteSpace: 'nowrap'
                }}
              >
                {value}
              </span>
            )}
            {subtext && (
              <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                {subtext}
              </span>
            )}
          </div>
          {icon && (
            <div style={{
              padding: '10px',
              borderRadius: 'var(--radius-default)',
              backgroundColor: 'var(--color-surface-container-low)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {icon}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default Card;
