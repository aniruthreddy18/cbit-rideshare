import { Component } from 'react';

/** Shows the actual error instead of a blank white page when a component crashes. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="container py-5" style={{ maxWidth: 720 }}>
        <div className="alert alert-danger shadow-sm">
          <h4 className="alert-heading">
            <i className="bi bi-exclamation-octagon me-2" />
            This page failed to load
          </h4>
          <p className="mb-2">{error.message || String(error)}</p>
          {import.meta.env.DEV && error.stack && (
            <pre className="small bg-white p-2 rounded border overflow-auto" style={{ maxHeight: 240 }}>
              {error.stack}
            </pre>
          )}
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => window.location.assign('/')}>
            Back to home
          </button>
        </div>
      </div>
    );
  }
}
