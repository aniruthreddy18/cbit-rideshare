import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

export function signToken(userId) {
  return jwt.sign({ id: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/** Requires a valid "Authorization: Bearer <token>" header and loads req.user. */
export async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Please log in to continue.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new AppError(
      401,
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Your session is invalid. Please log in again.'
    );
  }

  const user = await User.findById(payload.id);
  if (!user) throw new AppError(401, 'The account for this session no longer exists. Please register again.');

  req.user = user;
  next();
}
