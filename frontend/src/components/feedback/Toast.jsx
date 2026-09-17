import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast-${type}`}>
      <span style={{ display: 'flex', color: type === 'success' ? 'var(--color-tertiary-container)' : 'var(--color-error)' }}>
        {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      </span>
      <span style={{ fontSize: '13px', fontWeight: '500', flexGrow: 1 }}>{message}</span>
      <button type="button" onClick={onClose} style={{ display: 'flex', color: 'var(--color-secondary)' }}>
        <X size={14} />
      </button>
    </div>
  );
}
export default Toast;
