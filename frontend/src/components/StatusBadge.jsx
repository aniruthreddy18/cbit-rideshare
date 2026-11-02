const STYLES = {
  pending: { cls: 'text-bg-warning', icon: 'hourglass-split', label: 'Pending' },
  confirmed: { cls: 'text-bg-success', icon: 'check-circle', label: 'Confirmed' },
  rejected: { cls: 'text-bg-danger', icon: 'x-circle', label: 'Rejected' },
  cancelled: { cls: 'text-bg-secondary', icon: 'slash-circle', label: 'Cancelled' },
  active: { cls: 'text-bg-primary', icon: 'broadcast', label: 'Active' },
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || { cls: 'text-bg-light', icon: 'question-circle', label: status };
  return (
    <span className={`badge rounded-pill ${style.cls}`}>
      <i className={`bi bi-${style.icon} me-1`} />
      {style.label}
    </span>
  );
}
