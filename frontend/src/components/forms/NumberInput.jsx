import { handleNumberKeyDownBlock } from '../../utils/validators.js';

export function NumberInput({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  required = false,
  allowDecimals = true,
  ...props
}) {
  const handleKeyDown = (e) => {
    handleNumberKeyDownBlock(e);
    
    // Allow digits, backspace, tab, enter, delete, arrows, and dot/comma (if allowDecimals)
    const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (allowDecimals) {
      allowedKeys.push('.', ',');
    }
    
    // Allow ctrl+a, ctrl+c, ctrl+v, ctrl+x
    const isModifierKey = e.ctrlKey || e.metaKey;
    const modifierAllowedKeys = ['a', 'c', 'v', 'x'];
    
    if (isModifierKey && modifierAllowedKeys.includes(e.key.toLowerCase())) {
      return;
    }
    
    // Check if key is a digit or allowed control key
    if (!/^\d$/.test(e.key) && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    // Strip non-numeric chars
    const numericRegex = allowDecimals ? /[^\d.,]/g : /[^\d]/g;
    if (numericRegex.test(pastedText)) {
      e.preventDefault();
      let sanitized = pastedText.replace(numericRegex, '');
      if (allowDecimals) {
        sanitized = sanitized.replace(',', '.');
      }
      const syntheticEvent = {
        target: {
          name,
          value: value + sanitized,
        },
      };
      onChange(syntheticEvent);
    }
  };

  const handleChange = (e) => {
    let val = e.target.value;
    
    // Allow empty value
    if (val === '') {
      onChange(e);
      return;
    }

    if (allowDecimals) {
      val = val.replace(',', '.');
      // Prevent multiple decimal points
      const parts = val.split('.');
      if (parts.length > 2) {
        return;
      }
    }
    
    const syntheticEvent = {
      target: {
        name,
        value: val,
      },
    };
    onChange(syntheticEvent);
  };

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={name} className="form-label">
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        className={`form-control ${error ? 'has-error' : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
