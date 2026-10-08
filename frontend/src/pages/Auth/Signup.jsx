import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from './AuthLayout';

const Signup = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const features = [
    {
      title: 'SECURE OPERATIONS',
      description: 'Bank-grade encryption for all service records and customer financial data.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      )
    },
    {
      title: 'INSTANT DEPLOYMENT',
      description: 'Get your workshop online in minutes with our streamlined onboarding process.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )
    },
    {
      title: '24/7 PRIORITY SUPPORT',
      description: 'Access our dedicated technical team whenever you need assistance.',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      )
    }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const mobile = formData.mobile.trim().replace(/[\s()-]/g, '');
    if (formData.fullName.trim().length < 2) {
      setError('Enter your full name (at least 2 characters).');
      return;
    }
    if (!/^\+?\d{10,15}$/.test(mobile)) {
      setError('Enter a mobile number with 10 to 15 digits, optionally starting with +.');
      return;
    }
    if (formData.password.length < 8 || new TextEncoder().encode(formData.password).length > 72) {
      setError('Password must contain at least 8 characters and no more than 72 UTF-8 bytes.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/register`, {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        mobile,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });
      navigate('/login', { replace: true, state: { message: 'Account created successfully. Sign in to continue.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title={['ELEVATE YOUR', 'SERVICE', 'STANDARDS.']}
      subtitle="Join the elite network of workshops using AutoServ Pro to drive efficiency, transparency, and customer loyalty."
      features={features}
    >
      <div className="form-header">
        <h2>CREATE YOUR ACCOUNT</h2>
        <p>Create your customer account to book and track vehicle services</p>
      </div>

      {error && <div role="alert" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">FULL NAME</label>
          <div className="form-input-wrapper">
            <span className="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <input 
              type="text" 
              name="fullName"
              minLength={2}
              maxLength={100}
              autoComplete="name"
              className="form-input" 
              placeholder="e.g. John Miller" 
              value={formData.fullName}
              onChange={handleChange}
              required 
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">EMAIL ADDRESS</label>
            <div className="form-input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input 
                type="email" 
                name="email"
                maxLength={254}
                autoComplete="email"
                className="form-input" 
                placeholder="john@workshop.com" 
                value={formData.email}
                onChange={handleChange}
                required 
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">MOBILE NUMBER</label>
            <div className="form-input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <input 
                type="tel" 
                name="mobile"
                autoComplete="tel"
                className="form-input" 
                placeholder="+1 (555) 000-0000" 
                value={formData.mobile}
                onChange={handleChange}
                required 
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">CHOOSE PASSWORD</label>
          <div className="form-input-wrapper">
            <span className="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <input 
              type="password" 
              name="password"
              minLength={8}
              autoComplete="new-password"
              className="form-input" 
              placeholder="••••••••" 
              value={formData.password}
              onChange={handleChange}
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

        <div className="form-group">
          <label className="form-label">CONFIRM PASSWORD</label>
          <div className="form-input-wrapper">
            <span className="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <input 
              type="password" 
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              className="form-input" 
              placeholder="••••••••" 
              value={formData.confirmPassword}
              onChange={handleChange}
              required 
            />
          </div>
        </div>

        <div className="form-checkbox" style={{ alignItems: 'flex-start', marginTop: '1rem' }}>
          <input 
            type="checkbox" 
            id="agreeTerms" 
            name="agreeTerms"
            checked={formData.agreeTerms}
            onChange={handleChange}
            required
            style={{ marginTop: '0.2rem' }}
          />
          <label htmlFor="agreeTerms" style={{ lineHeight: '1.4' }}>
            I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>, including the automated workshop messaging consent.
          </label>
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '2rem' }}>
          {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>

        <div className="form-footer" style={{ marginTop: '3rem' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: '600', textTransform: 'uppercase' }}>Sign In</Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Signup;
