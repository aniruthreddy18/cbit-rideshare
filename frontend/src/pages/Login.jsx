import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage, getFieldErrors } from '../api/client.js';
import AlertMessage from '../components/AlertMessage.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/find-ride';

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (!form.password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setError('');
    clearSessionMessage();
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed.'));
      setErrors(getFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-7 col-lg-5">
          <div className="card auth-card shadow-sm border-0">
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <span className="auth-icon"><i className="bi bi-box-arrow-in-right" /></span>
                <h1 className="h3 fw-bold mt-3 mb-1">Welcome back</h1>
                <p className="text-secondary mb-0">Log in with your CBIT email</p>
              </div>

              <AlertMessage type="warning" onClose={clearSessionMessage}>{sessionMessage}</AlertMessage>
              <AlertMessage onClose={() => setError('')}>{error}</AlertMessage>

              <form onSubmit={onSubmit} noValidate>
                <FormField
                  label="CBIT email"
                  name="email"
                  type="email"
                  icon="envelope"
                  placeholder="rollnumber@cbit.ac.in"
                  autoComplete="email"
                  value={form.email}
                  onChange={onChange}
                  error={errors.email}
                  autoFocus
                />
                <FormField label="Password" name="password" icon="lock" error={errors.password}>
                  <input
                    id="field-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control${errors.password ? ' is-invalid' : ''}`}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={onChange}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`bi bi-eye${showPassword ? '-slash' : ''}`} />
                  </button>
                </FormField>

                <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={submitting}>
                  {submitting && <span className="spinner-border spinner-border-sm me-2" />}
                  Log in
                </button>
              </form>

              <p className="text-center text-secondary small mt-4 mb-0">
                New to CBIT RideShare? <Link to="/register" state={location.state}>Create an account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
