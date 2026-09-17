import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export function Alert({ type = 'error', message, onClose, ...props }) {
  if (!message) return null;

  const iconMap = {
    error: <AlertCircle size={18} />,
    success: <CheckCircle2 size={18} />,
    warning: <AlertCircle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className={`alert alert-${type}`} role="alert" {...props}>
      <span style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
        {iconMap[type]}
      </span>
      <div style={{ flexGrow: 1, fontSize: '14px', lineHeight: '1.4' }}>
        {message}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ display: 'flex', flexShrink: 0, color: 'currentColor', opacity: 0.7, padding: '2px' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export default Alert;
