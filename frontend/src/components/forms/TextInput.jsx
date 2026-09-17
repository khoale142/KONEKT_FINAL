import { handleKeyDownBlock, isVietnameseAccented, hasEmoji, hasDangerousChars, sanitizeTextInput } from '../../utils/validators.js';

export function TextInput({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  maxLength = 63,
  required = false,
  type = 'text',
  ...props
}) {
  const handleKeyDown = (e) => {
    handleKeyDownBlock(e);
  };

  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    // If it contains accents, emojis or dangerous characters, we sanitize it and let it pass or block
    if (isVietnameseAccented(pastedText) || hasEmoji(pastedText) || hasDangerousChars(pastedText)) {
      e.preventDefault();
      const sanitized = sanitizeTextInput(pastedText);
      // Construct a synthetic event to trigger onChange with sanitized text
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
      <input
        id={name}
        name={name}
        type={type}
        className={`form-control ${error ? 'has-error' : ''}`}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
