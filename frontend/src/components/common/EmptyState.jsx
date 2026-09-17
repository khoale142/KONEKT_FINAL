import { Inbox } from 'lucide-react';

export function EmptyState({ message = 'Không có dữ liệu hiển thị.', icon, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-xl)',
      textAlign: 'center',
      color: 'var(--color-secondary)',
      backgroundColor: 'var(--color-surface-container-lowest)',
      borderRadius: 'var(--radius-md)'
    }}>
      <div style={{ marginBottom: '12px', color: 'var(--color-outline-variant)' }}>
        {icon ? icon : <Inbox size={40} />}
      </div>
      <p style={{ fontSize: '14px', margin: '0 0 16px 0', maxWidth: '320px' }}>{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
export default EmptyState;
