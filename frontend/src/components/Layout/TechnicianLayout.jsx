import React from 'react';
import LogoutButton from '../../auth/LogoutButton';
import { useAuth } from '../../auth/useAuth';
import { Link, Outlet, useLocation } from 'react-router-dom';

const TechnicianLayout = () => {
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
      path: '/technician/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      path: '/technician/jobs',
      label: 'My Jobs',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
    {
      path: '/technician/messages',
      label: 'Messages',
      icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z',
    },
    {
      path: '/technician/history',
      label: 'Job History',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      path: '/technician/security',
      label: 'Account Security',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    },
  ];
  navItems.push({
    path: '/technician/account',
    label: 'Account settings',
    icon: 'M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z',
  });

  return (
    <div className="layout-container admin-theme technician-theme min-h-screen bg-app-black text-zinc-100">
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
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span className="brand-text">Tech Workspace</span>
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
            <input type="text" placeholder="Search job ID, vehicle..." />
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

export default TechnicianLayout;
