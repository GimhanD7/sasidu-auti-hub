import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true, state: { message: 'Signed out successfully.' } });
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="nav-item logout-button"
        aria-label={busy ? 'Signing out' : 'Log out'}
        title={busy ? 'Signing out' : 'Log out'}
        disabled={busy}
        onClick={handleLogout}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <span>{busy ? 'Signing out…' : 'Logout'}</span>
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
