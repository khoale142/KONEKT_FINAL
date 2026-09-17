import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function ConfirmDialog({
  isOpen,
  title = 'Xác nhận hành động',
  message = 'Bạn có chắc chắn muốn thực hiện hành động này?',
  onConfirm,
  onCancel,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  confirmVariant = 'danger', // danger, primary
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: confirmVariant === 'danger' ? 'var(--color-error)' : 'var(--color-primary)', display: 'flex' }}>
              <AlertTriangle size={18} />
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-primary)', margin: 0 }}>{title}</h3>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} style={{ color: 'var(--color-secondary)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--color-on-background)', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onCancel} disabled={loading} size="sm">
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading} size="sm">
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
export default ConfirmDialog;
