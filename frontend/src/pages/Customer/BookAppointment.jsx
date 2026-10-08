import React, { useState } from 'react';
import './BookAppointment.css';

const BookAppointment = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const steps = [
    { id: 1, label: 'VEHICLE' },
    { id: 2, label: 'SERVICE' },
    { id: 3, label: 'SCHEDULE' },
    { id: 4, label: 'CONFIRM' },
  ];

  const vehicles = [
    {
      id: 1,
      make: 'Toyota',
      model: 'Corolla',
      year: '2019',
      reg: 'CAA-1234',
      status: 'Active',
      image:
        'https://images.unsplash.com/photo-1590362891991-f776e747a588?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 2,
      make: 'Honda',
      model: 'Civic',
      year: '2021',
      reg: 'BXY-8821',
      status: 'Active',
      image:
        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 3,
      make: 'Ford',
      model: 'F-150',
      year: '2022',
      reg: 'TRK-5001',
      status: 'Active',
      image:
        'https://images.unsplash.com/photo-1559416523-140ddc3d238c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    },
  ];

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="booking-container">
      <div className="booking-header">
        <h1 className="page-title">BOOK SERVICE APPOINTMENT</h1>
        <p className="page-subtitle">
          Follow the steps below to schedule your next performance tuning or maintenance.
        </p>
      </div>

      {/* Stepper */}
      <div className="stepper">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`step-item ${currentStep === step.id ? 'active' : currentStep > step.id ? 'completed' : ''}`}
          >
            <div className="step-circle">{currentStep > step.id ? '✓' : step.id}</div>
            <span className="step-label">{step.label}</span>
            {index < steps.length - 1 && <div className="step-line"></div>}
          </div>
        ))}
      </div>

      <div className="step-content">
        {currentStep === 1 && (
          <div className="step-1">
            <div className="step-header">
              <h2 className="step-title">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="var(--primary-red)"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  ></path>
                </svg>
                Select Registered Vehicle
              </h2>
              <span className="step-indicator">STEP 1 OF 4</span>
            </div>

            <div className="vehicle-selection-grid">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className={`vehicle-select-card ${selectedVehicle === vehicle.id ? 'selected' : ''}`}
                  onClick={() => setSelectedVehicle(vehicle.id)}
                >
                  <div className="card-img-wrapper">
                    <img src={vehicle.image} alt={vehicle.model} />
                  </div>
                  <div className="card-info">
                    <h3>
                      {vehicle.make} {vehicle.model}
                    </h3>
                    <div className="card-details">
                      <span>
                        {vehicle.year} • {vehicle.reg}
                      </span>
                      <span className="status-badge">{vehicle.status}</span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="add-new-vehicle-card">
                <div className="add-icon">
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    ></path>
                  </svg>
                </div>
                <span>ADD NEW VEHICLE</span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-2 placeholder-step">
            <h2>Select Service Type</h2>
            <p>Service selection options will go here...</p>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-3 placeholder-step">
            <h2>Choose Date & Time</h2>
            <p>Calendar component will go here...</p>
          </div>
        )}

        {currentStep === 4 && (
          <div className="step-4 placeholder-step">
            <h2>Confirm Appointment</h2>
            <p>Confirmation summary will go here...</p>
          </div>
        )}
      </div>

      <div className="booking-footer">
        <button className="btn-outline prev-btn" onClick={handlePrev} disabled={currentStep === 1}>
          &lt; PREVIOUS
        </button>
        <button
          className="btn-primary next-btn"
          onClick={handleNext}
          disabled={currentStep === 1 && !selectedVehicle}
        >
          {currentStep === 4 ? 'CONFIRM BOOKING' : 'CONTINUE >'}
        </button>
      </div>
    </div>
  );
};

export default BookAppointment;
