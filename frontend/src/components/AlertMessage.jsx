export default function AlertMessage({ type = 'danger', children, onClose, className = '' }) {
  if (!children) return null;
  const icons = { danger: 'exclamation-circle', success: 'check-circle', warning: 'exclamation-triangle', info: 'info-circle' };
  return (
    <div className={`alert alert-${type} d-flex align-items-start gap-2 ${onClose ? 'alert-dismissible' : ''} ${className}`} role="alert">
      <i className={`bi bi-${icons[type] || 'info-circle'} flex-shrink-0 mt-1`} />
      <div className="flex-grow-1">{children}</div>
      {onClose && <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />}
    </div>
  );
}
