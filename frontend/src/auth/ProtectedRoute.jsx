// Wait for session verification, show retryable connection errors, and redirect visitors who lack the required role.
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { dashboardForRole } from './roles';

export default function ProtectedRoute({ role }) {
  const { user, signedOut, loading, sessionError, retrySession } = useAuth();
  const location = useLocation();
  if (loading || sessionError)
    return (
      <main className={`session-state-page ${sessionError ? 'has-error' : ''}`}>
        <section className="session-state-card" role={sessionError ? 'alert' : 'status'} aria-live="polite">
          <Link to="/home" className="session-state-brand" aria-label="AutoServ Pro home">
            <span className="session-state-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 14.5 5.2 9h13.6l2.2 5.5M4 14.5h16v4H4zM7 18.5v2m10-2v2M7 14h.01M17 14h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </span>
            <span>AutoServ <b>Pro</b></span>
          </Link>
          <div className={`session-state-icon ${loading ? 'is-loading' : ''}`} aria-hidden="true">
            {loading ? (
              <span className="session-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none"><path d="M4.5 9a11.5 11.5 0 0 1 15 0M7.5 12a7 7 0 0 1 9 0m-6 3a2.5 2.5 0 0 1 3 0M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </div>
          <p className="session-state-eyebrow">{loading ? 'SECURE ACCESS' : 'CONNECTION INTERRUPTED'}</p>
          <h1>{loading ? 'Checking your session' : 'We couldn’t reach your account'}</h1>
          <p className="session-state-copy">
            {loading
              ? 'Please wait while we securely verify your sign-in.'
              : sessionError}
          </p>
          {sessionError && (
            <>
              <div className="session-state-hint">
                <span aria-hidden="true">i</span>
                <p>Your account is safe. Reconnect to the workshop server and try again.</p>
              </div>
              <button className="session-retry-button" type="button" onClick={retrySession}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4.7 9a7.5 7.5 0 0 1 12.7-2L20 12M4 17v-5h5m10.3 3a7.5 7.5 0 0 1-12.7 2L4 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Try again
              </button>
              <Link to="/home" className="session-home-link">Return to home</Link>
            </>
          )}
          <div className="session-state-footer"><span />Secure session verification</div>
        </section>
      </main>
    );
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message: signedOut ? 'Signed out successfully.' : 'Please sign in to continue.',
        }}
      />
    );
  if (user.role !== role) return <Navigate to={dashboardForRole(user.role)} replace />;
  return <Outlet />;
}
