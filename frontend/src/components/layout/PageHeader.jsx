
export function PageHeader({ title, description, actions }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 'var(--spacing-lg)',
      flexWrap: 'wrap',
      gap: 'var(--spacing-md)'
    }}>
      <div>
        <h1 className="headline-lg" style={{ color: 'var(--color-primary)', fontWeight: '700', margin: 0 }}>{title}</h1>
        {description && (
          <p style={{ color: 'var(--color-secondary)', marginTop: '4px', fontSize: '14px', margin: 0 }}>{description}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
}
export default PageHeader;
