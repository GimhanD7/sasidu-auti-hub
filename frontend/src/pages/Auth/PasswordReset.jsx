import PasswordInput from '../../components/PasswordInput';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import AuthLayout from './AuthLayout';

export default function PasswordReset({ reset = false }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setMessage('');
    if (reset && (password.length < 8 || new TextEncoder().encode(password).length > 72)) {
      setError('Password must contain at least 8 characters and no more than 72 UTF-8 bytes.');
      return;
    }
    if (reset && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(
        reset ? '/auth/reset-password' : '/auth/forgot-password',
        reset ? { token, password, confirmPassword } : { email: email.trim().toLowerCase() },
      );
      if (reset) navigate('/login', { replace: true, state: { message: data.message } });
      else setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to complete this request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={['YOUR ACCOUNT.', 'YOUR SERVICE.']}
      subtitle="Recover access to your vehicle service account."
      features={[]}
    >
      <div className="form-header">
        <h2>{reset ? 'Reset password' : 'Forgot password'}</h2>
        <p>
          {reset
            ? 'Choose a new password for your account.'
            : 'Enter your account email to request a reset link.'}
        </p>
      </div>
      {error && (
        <p className="auth-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-feedback" role="status">
          {message}
        </p>
      )}
      {reset && !validToken ? (
        <p role="alert">
          This reset link is invalid. <Link to="/forgot-password">Request a new link</Link>.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          {reset ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">
                  New password
                </label>
                <PasswordInput
                  id="new-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <PasswordInput
                  id="confirm-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Email address
              </label>
              <input
                id="reset-email"
                className="form-input"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : reset ? 'Reset password' : 'Send reset link'}
          </button>
        </form>
      )}
      <div className="form-footer">
        <Link to="/login">Back to sign in</Link>
        {reset && validToken && (
          <>
            {' '}
            · <Link to="/forgot-password">Request a new link</Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
