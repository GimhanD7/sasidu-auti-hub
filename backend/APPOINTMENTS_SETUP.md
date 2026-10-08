# Appointment booking configuration

Customer bookings use a one-booking-per-time-slot capacity. A slot is released when its appointment is saved with `Cancelled` or `Completed` status. Requests are accepted for the next 30 calendar days, and availability is displayed in 14-day ranges.

Set these optional backend environment variables to match the workshop schedule:

- `APPOINTMENT_SLOT_TIMES`: comma-separated local workshop times in 24-hour `HH:mm` format. Defaults to `09:00,10:00,11:00,13:00,14:00,15:00`.
- `APPOINTMENT_BUSINESS_DAYS`: comma-separated ISO weekdays (`1` Monday through `7` Sunday). Defaults to all seven days until the workshop's closed days are specified.

Dates are stored as UTC calendar-day values and appointment times are saved as the selected workshop-local time string. SMS and email delivery are not configured here; successful booking creates an in-app customer notification.
