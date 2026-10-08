import React from 'react';
import '../Customer/CustomerDashboard.css'; // Reusing dashboard styles

const TechnicianDashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">My Workspace</h1>
          <p className="page-subtitle">Welcome back, Mike. Here are your assigned jobs for today.</p>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          </div>
          <div className="card-info">
            <h3>Assigned Jobs</h3>
            <p className="card-value">4</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>In Progress</h3>
            <p className="card-value">1</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Awaiting Approval</h3>
            <p className="card-value">1</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Completed Today</h3>
            <p className="card-value">2</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="grid-col-2">
          <div className="section-card">
            <div className="section-header">
              <h2>Current Active Job</h2>
              <span className="badge" style={{ backgroundColor: '#f59e0b', color: 'white' }}>IN PROGRESS</span>
            </div>
            <div className="active-repair-details" style={{ backgroundColor: 'var(--bg-input)', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>JOB-1048</h3>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>URGENT</span>
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Toyota Camry (2020) - ABC-1234</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Customer Complaint: Brakes squealing when stopping.</p>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>Open Job Card</button>
                <button className="btn-outline" style={{ flex: 1, padding: '0.75rem', borderColor: '#10b981', color: '#10b981' }}>Complete Task</button>
              </div>
            </div>
          </div>
          
          <div className="section-card" style={{ marginTop: '2rem' }}>
            <div className="section-header">
              <h2>Pending Jobs</h2>
            </div>
            <div className="notification-list">
              <div className="notification-item">
                <div className="notif-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>📋</div>
                <div className="notif-content" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div>
                    <p><strong>JOB-1051: Honda Civic</strong></p>
                    <p>Oil Change & Full Service</p>
                  </div>
                  <button className="btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Start Job</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-col-1">
          <div className="section-card" style={{ marginBottom: '2rem' }}>
            <div className="section-header">
              <h2>Notifications</h2>
            </div>
            <div className="notification-list">
              <div className="notification-item">
                <div className="notif-icon">✅</div>
                <div className="notif-content">
                  <p><strong>Approval Received</strong></p>
                  <p>Customer approved brake pad replacement for JOB-1042.</p>
                  <span className="notif-time">10 mins ago</span>
                </div>
              </div>
              <div className="notification-item">
                <div className="notif-icon">⚠️</div>
                <div className="notif-content">
                  <p><strong>New High Priority Job</strong></p>
                  <p>JOB-1048 assigned to you.</p>
                  <span className="notif-time">1 hour ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboard;
