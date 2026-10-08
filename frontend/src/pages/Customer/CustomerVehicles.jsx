import React, { useState } from 'react';
import './CustomerVehicles.css';

const CustomerVehicles = () => {
  // Mock data based on the provided design
  const [vehicles] = useState([
    {
      id: 1,
      make: 'Toyota',
      model: 'Corolla',
      year: '2019',
      fuel: 'Petrol',
      mileage: '54,200 km',
      reg: 'CAA-1234',
      lastService: 'Aug 15, 2023',
      nextDue: 'Feb 15, 2024',
      status: 'ACTIVE SERVICE',
      health: 'GOOD',
      image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 2,
      make: 'Honda',
      model: 'Civic',
      year: '2021',
      fuel: 'Hybrid',
      mileage: '28,150 km',
      reg: 'BXY-8821',
      lastService: 'Oct 02, 2023',
      nextDue: 'Apr 02, 2024',
      status: 'SERVICE DUE SOON',
      health: 'GOOD',
      image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 3,
      make: 'Ford',
      model: 'F-150',
      year: '2022',
      fuel: 'Diesel',
      mileage: '12,400 km',
      reg: 'TRK-5001',
      lastService: 'Jun 10, 2023',
      nextDue: 'Jun 10, 2024',
      status: 'NO CURRENT SERVICE',
      health: 'GOOD',
      image: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    }
  ]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'ACTIVE SERVICE':
        return { color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'SERVICE DUE SOON':
        return { color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)', bg: 'rgba(245, 158, 11, 0.1)' };
      default:
        return { color: '#9ca3af', borderColor: 'rgba(156, 163, 175, 0.2)', bg: 'rgba(156, 163, 175, 0.1)' };
    }
  };

  return (
    <div className="vehicles-container">
      <div className="vehicles-header">
        <div>
          <h1 className="page-title">MY VEHICLES</h1>
          <p className="page-subtitle">Manage your garage and track service status for all registered vehicles.</p>
        </div>
        <button className="btn-primary" style={{ padding: '0.75rem 1.5rem', width: 'auto' }}>
          + ADD VEHICLE
        </button>
      </div>

      <div className="vehicles-toolbar">
        <div className="search-bar">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input type="text" placeholder="Search by make, model, or license plate..." />
        </div>
        <div className="toolbar-actions">
          <button className="btn-outline">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
            Filters
          </button>
          <button className="btn-outline">Sort: Recently Added</button>
        </div>
      </div>

      <div className="vehicles-grid">
        {vehicles.map(vehicle => {
          const style = getStatusStyle(vehicle.status);
          return (
            <div key={vehicle.id} className="vehicle-card">
              <div className="vehicle-image-wrapper">
                <img src={vehicle.image} alt={vehicle.model} className="vehicle-image" />
                <div className="status-badge" style={{ color: style.color, backgroundColor: style.bg, borderColor: style.color }}>
                  {vehicle.status}
                </div>
                <button className="context-menu-btn">⋮</button>
              </div>
              
              <div className="vehicle-info">
                <div className="vehicle-title-row">
                  <h2>{vehicle.make} {vehicle.model}</h2>
                  <span className="reg-badge">{vehicle.reg}</span>
                </div>
                <p className="vehicle-specs">{vehicle.year} • {vehicle.fuel} • {vehicle.mileage}</p>
                
                <div className="service-dates">
                  <div className="date-box">
                    <span className="date-label">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      LAST SERVICE
                    </span>
                    <span className="date-value">{vehicle.lastService}</span>
                  </div>
                  <div className="date-box align-right">
                    <span className="date-label">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      NEXT DUE
                    </span>
                    <span className="date-value">{vehicle.nextDue}</span>
                  </div>
                </div>

                <div className="health-section">
                  <div className="health-header">
                    <span className="health-label">HEALTH STATUS</span>
                    <span className="health-status">{vehicle.health}</span>
                  </div>
                  <div className="health-bar-bg">
                    <div className="health-bar-fill" style={{ width: '85%' }}></div>
                  </div>
                </div>

                <button className="view-details-btn">VIEW VEHICLE DETAILS &gt;</button>
              </div>
            </div>
          );
        })}

        <div className="add-vehicle-card">
          <div className="add-icon">+</div>
          <h3>REGISTER NEW VEHICLE</h3>
          <p>Expanding your fleet? Add a new ride.</p>
        </div>
      </div>

      <div className="service-forecast-section">
        <h2 className="forecast-title">
          <svg width="24" height="24" fill="none" stroke="var(--primary-red)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          Service Forecast
        </h2>
        
        <div className="forecast-grid">
          <div className="forecast-card warning">
            <div className="forecast-icon warning-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <div className="forecast-content">
              <h3>IMMEDIATE ATTENTION REQUIRED</h3>
              <p>Your <strong>Honda Civic (BXY-8821)</strong> is approaching its 30,000 km milestone. We recommend booking a Major Service within the next 15 days to maintain warranty coverage.</p>
              <button className="text-btn warning-text">SCHEDULE NOW</button>
            </div>
          </div>

          <div className="forecast-card promo">
            <div className="forecast-icon promo-icon">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path>
              </svg>
            </div>
            <div className="forecast-content">
              <h3>WORKSHOP AVAILABILITY</h3>
              <p>Our main workshop at <strong>Metro Central</strong> has open slots this Thursday for express oil changes. Exclusive 10% discount for app users.</p>
              <button className="text-btn promo-text">CLAIM DISCOUNT</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerVehicles;
