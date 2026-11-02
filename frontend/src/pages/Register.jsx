import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage, getFieldErrors } from '../api/client.js';
import AlertMessage from '../components/AlertMessage.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

// Mirrors the server rules in backend/src/controllers/authController.js
function validate(form) {
  const errors = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2-60 characters.';
  else if (!/^[a-zA-Z][a-zA-Z .'-]*$/.test(name)) errors.name = 'Use letters, spaces, dots, hyphens and apostrophes only.';

  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address (e.g. name@gmail.com).';

  const phone = form.phone.replace(/[\s()-]/g, '');
  if (!/^(?:\+?91|0)?[6-9]\d{9}$/.test(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';

  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (form.password.length > 72) errors.password = 'Password must be at most 72 characters.';
  else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errors.password = 'Include at least one letter and one number.';

  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
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
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setError('');
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate(location.state?.from || '/find-ride', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed.'));
      setErrors(getFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  const passwordType = showPassword ? 'text' : 'password';

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card auth-card shadow-sm border-0">
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <span className="auth-icon"><i className="bi bi-person-plus" /></span>
                <h1 className="h3 fw-bold mt-3 mb-1">Create your account</h1>
                <p className="text-secondary mb-0">Join CBIT students sharing rides to and from campus.</p>
              </div>

              <AlertMessage onClose={() => setError('')}>{error}</AlertMessage>

              <form onSubmit={onSubmit} noValidate>
                <FormField label="Full name" name="name" icon="person" autoComplete="name" value={form.name} onChange={onChange} error={errors.name} autoFocus />
                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  icon="envelope"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={onChange}
                  error={errors.email}
                />
                <FormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  icon="telephone"
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={onChange}
                  error={errors.phone}
                  hint="Shared only with students on a confirmed ride with you."
                />
                <div className="row">
                  <div className="col-sm-6">
                    <FormField
                      label="Password"
                      name="password"
                      type={passwordType}
                      icon="lock"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={onChange}
                      error={errors.password}
                      hint="8+ characters, letters and numbers"
                    />
                  </div>
                  <div className="col-sm-6">
                    <FormField
                      label="Confirm password"
                      name="confirmPassword"
                      type={passwordType}
                      icon="lock-fill"
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={onChange}
                      error={errors.confirmPassword}
                    />
                  </div>
                </div>
                <div className="form-check mb-3">
                  <input id="show-password" type="checkbox" className="form-check-input" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                  <label htmlFor="show-password" className="form-check-label small">Show passwords</label>
                </div>

                <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={submitting}>
                  {submitting && <span className="spinner-border spinner-border-sm me-2" />}
                  Create account
                </button>
              </form>

              <p className="text-center text-secondary small mt-4 mb-0">
                Already registered? <Link to="/login" state={location.state}>Log in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
