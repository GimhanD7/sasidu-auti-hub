// Wait for session verification, show retryable connection errors, and redirect visitors who lack the required role.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { dashboardForRole } from './roles';

export default function ProtectedRoute({ role }) {
  const { user, signedOut, loading, sessionError, retrySession } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Checking your session…</p>;
  if (sessionError)
    return (
      <div role="alert">
        <p>{sessionError}</p>
        <button onClick={retrySession}>Try again</button>
      </div>
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
