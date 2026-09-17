
export function SelectInput({
  label,
  name,
  value,
  onChange,
  error,
  options = [],
  disabled = false,
  required = false,
  placeholder,
  ...props
}) {
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={name} className="form-label">
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        className={`form-select ${error ? 'has-error' : ''}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
