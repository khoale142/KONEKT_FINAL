import React from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  
  const sizeMap = {
    'sm': '450px',
    'md': '600px',
    'lg': '800px',
    'xl': '1000px',
    '2xl': '1200px',
    '3xl': '1400px',
  };
  
  const maxWidth = sizeMap[size] || '600px';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ padding: '24px' }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-outline-variant)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-primary)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--color-secondary)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
