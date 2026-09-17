import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { handleKeyDownBlock, isVietnameseAccented, hasEmoji, hasDangerousChars, sanitizeTextInput } from '../../utils/validators.js';

export function PasswordInput({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  maxLength = 63,
  required = false,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);

  const toggleShow = () => {
    setShowPassword(!showPassword);
  };

  const handleKeyDown = (e) => {
    handleKeyDownBlock(e);
  };

  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    if (isVietnameseAccented(pastedText) || hasEmoji(pastedText) || hasDangerousChars(pastedText)) {
      e.preventDefault();
      const sanitized = sanitizeTextInput(pastedText);
      const syntheticEvent = {
        target: {
          name,
          value: value + sanitized,
        },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={name} className="form-label">
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
        <input
          id={name}
          name={name}
          type={showPassword ? 'text' : 'password'}
          className={`form-control ${error ? 'has-error' : ''}`}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          style={{ paddingRight: '40px' }}
          {...props}
        />
        <button
          type="button"
          onClick={toggleShow}
          disabled={disabled}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--color-secondary)',
          }}
          tabIndex="-1"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
