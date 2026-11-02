import { signToken } from '../middleware/auth.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { EMAIL_REGEX, normalizePhone, str, throwIfErrors } from '../utils/validators.js';

function authResponse(res, status, user) {
  res.status(status).json({ success: true, token: signToken(user._id), user });
}

// POST /api/auth/register
export async function register(req, res) {
  const name = str(req.body?.name).replace(/\s+/g, ' ');
  const email = str(req.body?.email).toLowerCase();
  const phone = normalizePhone(req.body?.phone);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  const errors = {};
  if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2-60 characters.';
  else if (!/^[a-zA-Z][a-zA-Z .'-]*$/.test(name)) errors.name = 'Name can contain only letters, spaces, dots, hyphens and apostrophes.';

  if (!email) errors.email = 'Email is required.';
  else if (email.length > 254 || !EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address (e.g. name@gmail.com).';

  if (!phone) errors.phone = 'Enter a valid 10-digit Indian mobile number.';

  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (password.length > 72) errors.password = 'Password must be at most 72 characters.';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = 'Password must contain at least one letter and one number.';

  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  throwIfErrors(errors);

  if (await User.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists. Please log in instead.', {
      email: 'Email already registered',
    });
  }

  // A concurrent duplicate registration is still caught by the unique index (409 in errorHandler).
  const user = await User.create({ name, email, phone, password });
  authResponse(res, 201, user);
}

// POST /api/auth/login
export async function login(req, res) {
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const errors = {};
  if (!email) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  throwIfErrors(errors, 'Please enter your email and password.');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(401, 'Incorrect email or password.');
  }
  authResponse(res, 200, user);
}

// GET /api/auth/me
export async function getMe(req, res) {
  res.json({ success: true, user: req.user });
}
