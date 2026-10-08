import PasswordInput from '../../components/PasswordInput';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('New password must be no more than 72 UTF-8 bytes.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      await logout();
      navigate('/login', { replace: true, state: { message: data.message } });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Unable to change your password. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="technician-security-page">
      <header>
        <h1 className="page-title">Account Security</h1>
        <p className="page-subtitle">Change your account password.</p>
      </header>
      <section className="section-card technician-password-card">
        <h2>Change password</h2>
        {error && (
          <p className="technician-security-error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Current password
            <PasswordInput
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            New password
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <small>At least 8 characters. Youâ€™ll be signed out after changing it.</small>
          </label>
          <label>
            Confirm new password
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <footer>
            <button type="submit" disabled={saving}>
              {saving ? 'Changingâ€¦' : 'Change password'}
            </button>
          </footer>
        </form>
      </section>
    </section>
  );
}
