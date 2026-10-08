import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { dashboardForRole } from '../../auth/roles';
import AuthLayout from './AuthLayout';

const Login = ({ adminOnly = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login, loading: sessionLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const features = [
    {
      title: 'REAL-TIME WORKFLOW MONITORING',
      description: 'Track vehicle service status live.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      )
    },
    {
      title: 'SECURE SERVICE RECORDS',
      description: 'Bank-grade encryption for all service data.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      )
    },
    {
      title: 'AUTOMATED CUSTOMER SCHEDULING',
      description: 'Seamless appointment bookings.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      )
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || sessionLoading) return;
    setError('');
    setLoading(true);
    try {
      const user = await login({
        email: email.trim(),
        password,
        remember,
        adminOnly,
      });
      navigate(dashboardForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title={adminOnly ? ['WORKSHOP', 'ADMIN PORTAL.'] : ['SMART VEHICLE', 'SERVICE.', 'COMPLETE TRAN', 'SPARENCY.']}
      subtitle={adminOnly ? 'Secure sign in for workshop administrators and service managers.' : 'Empowering workshops with high-performance digital tools to streamline operations and build customer trust.'}
      features={features}
    >
      <div className="form-header">
        <h2>{adminOnly ? 'ADMIN SIGN IN' : 'WELCOME BACK'}</h2>
        <p>{adminOnly ? 'Use your administrator or service-manager account' : 'Sign in to continue to your workshop account'}</p>
      </div>

      {error && <div role="alert" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{error}</div>}

      {location.state?.message && <p className="auth-feedback" role="status">{location.state.message}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">EMAIL OR PHONE NUMBER</label>
          <div className="form-input-wrapper">
            <span className="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </span>
            <input 
              type="text" 
              id="login-email"
              autoComplete="username"
              className="form-input" 
              placeholder="technician@autoserv.pro" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
        </div>

        <div className="form-group">
          <div className="form-label">
            <label htmlFor="login-password">PASSWORD</label>
            <Link to="/forgot-password" style={{ fontSize: '0.75rem', textTransform: 'none' }}>Forgot Password?</Link>
          </div>
          <div className="form-input-wrapper">
            <span className="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <input 
              type="password" 
              id="login-password"
              autoComplete="current-password"
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <span className="input-icon-right">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </span>
          </div>
        </div>

        <div className="form-checkbox">
          <input type="checkbox" id="remember" checked={remember} onChange={event => setRemember(event.target.checked)} />
          <label htmlFor="remember">Remember this device</label>
        </div>

        <button type="submit" className="btn-primary" disabled={loading || sessionLoading}>
          {loading ? 'Signing in…' : sessionLoading ? 'Checking session…' : 'Sign In'}
        </button>

        <div className="form-divider">
          <span>OR</span>
        </div>

        <div className="form-footer">
          {adminOnly ? <>Workshop user? <Link to="/login">Sign in here</Link></> : <>New customer? <Link to="/signup">Create Account</Link></>}
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;
