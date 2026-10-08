import React from 'react';
import LogoutButton from '../../auth/LogoutButton';
import { useAuth } from '../../auth/useAuth';
import { Link, Outlet, useLocation } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const initials = user?.fullName?.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/admin/appointments', label: 'Appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/admin/kanban', label: 'Workshop Board', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { path: '/admin/messages', label: 'Messages', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z' },
    { path: '/admin/customers', label: 'Customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { path: '/admin/vehicles', label: 'Vehicles', icon: 'M3 13l2-5h14l2 5M5 13h14l1 6H4l1-6zm2 6v2m10-2v2M7 16h.01M17 16h.01' },
    { path: '/admin/technicians', label: 'Technicians', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { path: '/admin/allocations', label: 'Job Allocation', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 3c-2.285 0-4.42.64-6.236 1.984A11.955 11.955 0 013 12c0 2.285.64 4.42 1.984 6.236A11.955 11.955 0 0012 21c2.285 0 4.42-.64 6.236-1.984A11.955 11.955 0 0021 12c0-2.285-.64-4.42-1.984-6.236z' },
    { path: '/admin/services', label: 'Service Types', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
  ];
  navItems.push({ path: '/admin/users', label: 'User Roles', icon: 'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21v-2a8 8 0 0116 0v2' });
  navItems.push({ path: '/admin/account', label: 'Account settings', icon: 'M20 21a8 8 0 00-16 0m8-10a4 4 0 100-8 4 4 0 000 8z' });

  return (
    <div className="layout-container admin-theme">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <span className="brand-text">Admin Panel</span>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`nav-item ${location.pathname.includes(item.path) ? 'active' : ''}`}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input type="text" placeholder="Search appointments, jobs, customers, vehicles..." />
          </div>
          <div className="topbar-actions">
            <button className="icon-btn">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
              </svg>
            </button>
            <div className="user-profile">
              <div className="avatar" style={{backgroundColor: '#3b82f6'}}>{initials}</div>
              <span>{user?.fullName}</span>
            </div>
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
