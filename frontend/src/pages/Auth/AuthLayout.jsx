// Provide the shared visual layout around authentication forms.
import React from 'react';
import { Link } from 'react-router-dom';
const AuthLayout = ({ children, title, subtitle, features }) => {
  return (
    <div className="auth-container">
      {/* Left Side - Branding */}
      <div className="auth-left">
        <Link className="brand-logo" to="/home" aria-label="Go to home">
          <div className="logo-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span className="logo-text">AutoServ Pro</span>
        </Link>

        <h1 className="auth-title">
          {title.map((line, idx) => (
            <span key={idx} className={idx % 2 !== 0 ? 'auth-title-highlight' : ''}>
              {line}
              <br />
            </span>
          ))}
        </h1>

        <p className="auth-subtitle">{subtitle}</p>

        <div className="auth-features">
          {features.map((feature, idx) => (
            <div key={idx} className="feature-item">
              <div className="feature-icon">{feature.icon}</div>
              <div className="feature-text">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="auth-footer">
          <div>© 2026 AUTOSERV PRO SYSTEMS. ALL RIGHTS RESERVED.</div>
          <div className="auth-footer-links">
            <span>ENTERPRISE-READY</span>
            <span>•</span>
            <span>ISO 27001 CERTIFIED</span>
            <span>•</span>
            <span>GDPR COMPLIANT</span>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="auth-right">
        <div className="auth-form-container">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;
