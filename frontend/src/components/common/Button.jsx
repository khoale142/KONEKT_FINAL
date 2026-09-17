
export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary, secondary, danger, ghost
  size = 'md', // md, sm
  loading = false,
  disabled = false,
  icon,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${loading ? 'btn-loading' : ''}`}
      {...props}
    >
      {!loading && icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
export default Button;
