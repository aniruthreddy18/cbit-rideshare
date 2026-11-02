/** Bootstrap input with label, icon and validation message. */
export default function FormField({ label, name, error, icon, hint, children, ...inputProps }) {
  const id = inputProps.id || `field-${name}`;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="form-label fw-semibold small">{label}</label>
      <div className={`input-group${error ? ' has-validation' : ''}`}>
        {icon && <span className="input-group-text"><i className={`bi bi-${icon}`} /></span>}
        {children || <input id={id} name={name} className={`form-control${error ? ' is-invalid' : ''}`} {...inputProps} />}
        {error && <div className="invalid-feedback">{error}</div>}
      </div>
      {hint && !error && <div className="form-text">{hint}</div>}
    </div>
  );
}
