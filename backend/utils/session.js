import { createHash, randomBytes } from 'node:crypto';
import AuthSession from '../models/AuthSession.js';

export const COOKIE_NAME = 'autoserv_session';
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const normalizeRole = role => ({ user: 'Customer', admin: 'Admin' }[role] || role);
export const publicUser = user => ({ _id: user._id, fullName: user.name, email: user.email, mobile: user.mobile, role: normalizeRole(user.role) });
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

export function readSessionToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`));
  const token = cookie?.slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

export async function createSession(user, remember, res) {
  const token = newToken();
  const maxAge = (remember ? 30 : 1) * 24 * 60 * 60 * 1000;
  await AuthSession.create({ user: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + maxAge), version: user.sessionVersion || 0 });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), ...(remember ? { maxAge } : {}) });
}
