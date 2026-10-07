import React from 'react';
import './CustomerDashboard.css';

const CustomerDashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Welcome back, John!</h1>
          <p className="page-subtitle">Here is a summary of your vehicle's status and upcoming appointments.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
          + Book Appointment
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Registered Vehicles</h3>
            <p className="card-value">2</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Active Repairs</h3>
            <p className="card-value">1</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Upcoming Appointments</h3>
            <p className="card-value">0</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Unpaid Invoices</h3>
            <p className="card-value">$450.00</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="grid-col-2">
          <div className="section-card">
            <div className="section-header">
              <h2>Active Repair Tracking</h2>
              <span className="badge badge-warning">In Progress</span>
            </div>
            <div className="active-repair-details">
              <div className="repair-vehicle">
                <div className="vehicle-image">🚗</div>
                <div>
                  <h4>Toyota Camry (2020)</h4>
                  <p>Reg: ABC-1234</p>
                </div>
              </div>
              <div className="repair-progress">
                <div className="progress-step completed">
                  <div className="step-circle">✓</div>
                  <span>Inspecting</span>
                </div>
                <div className="progress-step active">
                  <div className="step-circle">2</div>
                  <span>In Progress</span>
                </div>
                <div className="progress-step">
                  <div className="step-circle">3</div>
                  <span>Final Test</span>
                </div>
                <div className="progress-step">
                  <div className="step-circle">4</div>
                  <span>Ready</span>
                </div>
              </div>
              <div className="repair-eta">
                <strong>Estimated Completion:</strong> Today at 4:30 PM
              </div>
            </div>
          </div>
        </div>

        <div className="grid-col-1">
          <div className="section-card" style={{ marginBottom: '2rem' }}>
            <div className="section-header">
              <h2>Recent Notifications</h2>
            </div>
            <div className="notification-list">
              <div className="notification-item unread">
                <div className="notif-icon">🔔</div>
                <div className="notif-content">
                  <p><strong>Repair Started</strong></p>
                  <p>Technician has begun working on your Toyota Camry.</p>
                  <span className="notif-time">2 hours ago</span>
                </div>
              </div>
              <div className="notification-item">
                <div className="notif-icon">✅</div>
                <div className="notif-content">
                  <p><strong>Vehicle Checked In</strong></p>
                  <p>Your vehicle has been successfully checked in.</p>
                  <span className="notif-time">3 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
