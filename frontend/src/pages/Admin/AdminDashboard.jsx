import React from 'react';
import '../Customer/CustomerDashboard.css';

const AdminDashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Workshop Overview</h1>
          <p className="page-subtitle">Real-time status of appointments, jobs, and technician availability.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6' }}>
            + New Booking
          </button>
          <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#10b981' }}>
            + Create Job
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Today's Appointments</h3>
            <p className="card-value">12</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Active Workshop Jobs</h3>
            <p className="card-value">8</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Available Technicians</h3>
            <p className="card-value">3 / 5</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Daily Revenue Est.</h3>
            <p className="card-value">$1,250</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="summary-card" style={{ padding: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="badge" style={{ backgroundColor: '#6b7280', color: 'white', marginBottom: '0.5rem' }}>Inspecting</span>
          <p className="card-value">2 Vehicles</p>
        </div>
        <div className="summary-card" style={{ padding: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="badge" style={{ backgroundColor: '#f59e0b', color: 'white', marginBottom: '0.5rem' }}>In Progress</span>
          <p className="card-value">4 Vehicles</p>
        </div>
        <div className="summary-card" style={{ padding: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="badge" style={{ backgroundColor: '#8b5cf6', color: 'white', marginBottom: '0.5rem' }}>Final Test</span>
          <p className="card-value">1 Vehicle</p>
        </div>
        <div className="summary-card" style={{ padding: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className="badge" style={{ backgroundColor: '#10b981', color: 'white', marginBottom: '0.5rem' }}>Ready</span>
          <p className="card-value">1 Vehicle</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="grid-col-2">
          <div className="section-card">
            <div className="section-header">
              <h2>Jobs Awaiting Approval</h2>
            </div>
            <div className="active-repair-details">
              <div className="repair-vehicle" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div className="vehicle-image">🔧</div>
                <div style={{ flex: 1 }}>
                  <h4>Honda Civic - Brake Replacement</h4>
                  <p>Customer: John Miller • Est: $350.00</p>
                </div>
                <button className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Review Request</button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-col-1">
          <div className="section-card" style={{ marginBottom: '2rem' }}>
            <div className="section-header">
              <h2>Recent Workshop Activity</h2>
            </div>
            <div className="notification-list">
              <div className="notification-item">
                <div className="notif-icon">✅</div>
                <div className="notif-content">
                  <p><strong>Job Completed: Toyota Corolla</strong></p>
                  <p>Marked ready by Tech Mike.</p>
                  <span className="notif-time">10 mins ago</span>
                </div>
              </div>
              <div className="notification-item">
                <div className="notif-icon">👨‍🔧</div>
                <div className="notif-content">
                  <p><strong>Technician Assigned</strong></p>
                  <p>Sarah assigned to Ford Mustang.</p>
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

export default AdminDashboard;
