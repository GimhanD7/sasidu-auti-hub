import User from '../models/User.js';
import bcrypt from 'bcrypt';
import { validateRegistration } from '../utils/registration.js';
import AuthSession from '../models/AuthSession.js';
import { createSession, publicUser, COOKIE_NAME, cookieOptions, readSessionToken, hashToken, newToken } from '../utils/session.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';

export const registerUser = async (req, res) => {
  try {
    const { data, error } = validateRegistration(req.body);
    if (error) return res.status(400).json({ message: error });
    const { name, email, mobile, password } = data;

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (userExists) {
      return res.status(409).json({ message: 'User with this email or mobile already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      mobile,
      password: hashedPassword,
      role: 'Customer',
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        fullName: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'User with this email or mobile already exists' });
    res.status(500).json({ message: 'Unable to create account. Please try again.' });
  }
};

const authenticateUser = async (req, res, requiredRole) => {
  try {
    const { email, password, remember = false } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || typeof remember !== 'boolean') {
      return res.status(400).json({ message: 'Enter your email or mobile number and password.' });
    }
    const identifier = email.trim();
    let user;
    if (identifier.includes('@')) {
      const normalizedEmail = identifier.toLowerCase();
      user = await User.findOne({ email: normalizedEmail });
      // Earlier registrations preserved email casing. Match those existing accounts
      // while all newly registered addresses remain stored in normalized form.
      if (!user) {
        const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        user = await User.findOne({ email: { $regex: `^${escapedEmail}$`, $options: 'i' } });
      }
    } else {
      const normalizedMobile = identifier.replace(/[\s()-]/g, '');
      user = await User.findOne({ mobile: normalizedMobile });
    }
    if (!user || user.isActive === false || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!['user', 'admin', 'Customer', 'Admin', 'Technician', 'Finance'].includes(user.role)) {
      return res.status(403).json({ message: 'This account does not have access.' });
    }
    const normalizedRole = user.role === 'admin' ? 'Admin' : user.role === 'user' ? 'Customer' : user.role;
    if (requiredRole && normalizedRole !== requiredRole) {
      return res.status(403).json({ message: `This account does not have ${requiredRole.toLowerCase()} access.` });
    }
    await createSession(user, remember, res);
    res.json(publicUser(user));
  } catch {
    res.status(500).json({ message: 'Unable to sign in. Please try again.' });
  }
};

export const loginUser = (req, res) => authenticateUser(req, res);
export const adminLoginUser = (req, res) => authenticateUser(req, res, 'Admin');
export const technicianLoginUser = (req, res) => authenticateUser(req, res, 'Technician');

export const getCurrentUser = (req, res) => res.json(publicUser(req.user));

export async function logoutUser(req, res) {
  try {
    const token = readSessionToken(req);
    if (token) await AuthSession.deleteOne({ tokenHash: hashToken(token) });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.json({ message: 'Signed out successfully.' });
  } catch {
    res.status(503).json({ message: 'Unable to sign out. Please try again.' });
  }
}

export async function changeTechnicianPassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ message: 'Enter your current password and a new password with at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  if (newPassword !== confirmPassword) return res.status(400).json({ message: 'New passwords do not match.' });
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user || user.role !== 'Technician' || user.isActive === false) return res.status(404).json({ message: 'Technician account not found.' });
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: 'Current password is incorrect.' });
    if (await bcrypt.compare(newPassword, user.password)) return res.status(400).json({ message: 'Choose a new password that differs from your current password.' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();
    await AuthSession.deleteMany({ user: user._id });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.json({ message: 'Password changed successfully. Sign in again with your new password.' });
  } catch { res.status(503).json({ message: 'Unable to change your password. Please try again.' }); }
}

export async function forgotPassword(req, res) {
  const email = req.body?.email;
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!passwordResetEmail.isConfigured()) return res.status(503).json({ message: 'Password reset email is unavailable. Please contact the workshop.' });
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase(), isActive: { $ne: false } });
    if (user) {
      const token = newToken();
      const tokenHash = hashToken(token);
      await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
      try {
        await passwordResetEmail.send(user.email, token);
      } catch {
        await User.updateOne({ _id: user._id, resetTokenHash: tokenHash }, { $unset: { resetTokenHash: '', resetTokenExpiresAt: '' } });
        // Keep the public response identical for existing and unknown accounts.
        console.error('Password reset email could not be delivered. Check SMTP configuration.');
      }
    }
    res.json({ message: 'If an active account exists for this email, you will receive a password reset link.' });
  } catch {
    res.status(503).json({ message: 'Unable to request a password reset. Please try again.' });
  }
}

export async function resetPassword(req, res) {
  const { token, password, confirmPassword } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: 'This reset link is invalid or expired.' });
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must contain at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { resetTokenHash: hashToken(token), resetTokenExpiresAt: { $gt: new Date() }, isActive: { $ne: false } },
      { $set: { password: hashedPassword }, $inc: { sessionVersion: 1 }, $unset: { resetTokenHash: '', resetTokenExpiresAt: '' } },
      { returnDocument: 'after' },
    );
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or expired.' });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.json({ message: 'Password reset successfully. Sign in with your new password.' });
  } catch {
    res.status(503).json({ message: 'Unable to reset your password. Please try again.' });
  }
}
