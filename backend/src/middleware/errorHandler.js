import mongoose from 'mongoose';
import { isProduction } from '../config/env.js';
import AppError from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(404, `API route not found: ${req.method} ${req.originalUrl}`));
}

function duplicateKeyMessage(err) {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  if (fields.includes('email')) {
    return { message: 'An account with this email already exists. Please log in instead.', errors: { email: 'Email already registered' } };
  }
  if (fields.includes('ride') && fields.includes('passenger')) {
    return { message: 'You already have an active request for this ride.' };
  }
  return { message: `Duplicate value for ${fields.join(', ') || 'a unique field'}.` };
}

// Express recognises error handlers by their 4 arguments, so keep `_next`.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Something went wrong on the server.';
  let errors;

  if (err instanceof AppError) {
    ({ status, message, errors } = err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    errors = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]));
    message = Object.values(errors)[0] || 'Validation failed.';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (err?.code === 11000) {
    status = 409;
    ({ message, errors } = duplicateKeyMessage(err));
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON.';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large.';
  } else if (err?.name === 'MongooseServerSelectionError' || err?.name === 'MongoNetworkError') {
    status = 503;
    message = 'The database is unreachable right now. Check the backend terminal and your MongoDB Atlas settings.';
  } else if (!isProduction && err?.message) {
    message = `Server error: ${err.message}`;
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}\n`, err);
  }

  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });
}
