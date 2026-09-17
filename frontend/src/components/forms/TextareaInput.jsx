import { handleKeyDownBlock, isVietnameseAccented, hasEmoji, hasDangerousChars, sanitizeTextInput } from '../../utils/validators.js';

export function TextareaInput({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  maxLength = 255,
  required = false,
  rows = 3,
  ...props
}) {
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
      <textarea
        id={name}
        name={name}
        className={`form-textarea ${error ? 'has-error' : ''}`}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
