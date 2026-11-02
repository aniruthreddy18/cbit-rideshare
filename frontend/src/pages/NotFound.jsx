import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center">
      <i className="bi bi-signpost-split display-3 text-primary" />
      <h1 className="h3 fw-bold mt-3">Page not found</h1>
      <p className="text-secondary">The page you are looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div>
  );
}
