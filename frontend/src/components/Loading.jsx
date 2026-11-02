export default function Loading({ label = 'Loading...' }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 text-secondary" role="status">
      <div className="spinner-border text-primary mb-2" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
