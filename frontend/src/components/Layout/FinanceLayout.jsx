import React from 'react';
import LogoutButton from '../../auth/LogoutButton';
import { useAuth } from '../../auth/useAuth';
import { Link, Outlet, useLocation } from 'react-router-dom';

const FinanceLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const initials =
    user?.fullName
      ?.split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const navItems = [
    {
      path: '/finance/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      path: '/finance/invoices',
      label: 'Invoices',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      path: '/finance/payments',
      label: 'Payments',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
      path: '/finance/reports',
      label: 'Revenue Reports',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
  ];
  navItems.push({
    path: '/finance/account',
    label: 'Profile',
    icon: 'M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z',
  });

  return (
    <div className="layout-container admin-theme finance-theme min-h-screen bg-app-black text-zinc-100">
      <aside className="sidebar bg-app-surface text-zinc-100">
        <div className="sidebar-brand">
          <div className="brand-icon" style={{ backgroundColor: '#e11d2e' }}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <span className="brand-text">Finance Dept</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              title={item.label}
              className={`nav-item ${location.pathname.includes(item.path) ? 'active' : ''}`}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d={item.icon}
                ></path>
              </svg>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <LogoutButton />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-search">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
            <input type="text" placeholder="Search invoices, payments..." />
          </div>
          <div className="topbar-actions">
            <button className="icon-btn">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                ></path>
              </svg>
            </button>
            <div className="user-profile">
              <div className="avatar" style={{ backgroundColor: '#e11d2e' }}>
                {initials}
              </div>
              <span>{user?.fullName}</span>
            </div>
          </div>
        </header>

        <div className="content-area flex-1 bg-app-black text-zinc-100">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default FinanceLayout;
