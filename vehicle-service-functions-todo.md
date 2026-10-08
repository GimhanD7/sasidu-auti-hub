# Vehicle Service & Repair Tracking System — Development To-do List

Source: Vehicle_Service_Repair_System_Functions.pdf (18 pages).

58 functions. The numbered checklist below preserves the requirements in the PDF. Checked items have been implemented and locally verified; any remaining verification limitations are noted under the function.

## Analysis and suggested build order

1. Shared authentication, roles, database relationships, notifications and audit trail.
2. Customer/vehicle records, service types, technician profiles and availability.
3. Appointment booking, calendar, check-in and job allocation.
4. Job cards, inspections, diagnosis, tasks, parts and labour.
5. Additional repair approvals, tracking, messaging and final testing.
6. Invoices, payments, receipts, service history and reports.

## Decisions to resolve before implementation

These are analysis recommendations, not additional requirements quoted from the PDF.

- [ ] Define workshop capacity, slot duration and cancellation/rescheduling rules.
- [ ] Decide which notification channels to support and when reminders run.
- [ ] Decide whether card/online payments use a payment gateway or recorded external payments.
- [ ] Define currency, tax, discount, labour rates and invoice due-date rules.
- [ ] Keep repair stages (Inspecting, In Progress, Final Test, Ready) separate from approval status; determine whether waiting for approval pauses the entire job or only related tasks.
- [ ] Define when a Ready job becomes completed/closed and how that updates appointment status and service history.
- [ ] Define vehicle removal rules and retain records required by existing jobs/invoices.
- [ ] Maintain parts purchase cost separately from selling price for the parts cost report.
- [ ] Define report revenue basis (payments received or invoiced amounts) and technician attribution.

## Function-by-function checklist


## 1. Customer Portal

### 1.1 Customer Registration

- [x] Create customer account
- [x] Enter full name, email address and mobile number
- [x] Create and confirm password
- [x] Validate email and mobile number formats
- [x] Check duplicate email/mobile number
- [x] Store password securely
- [x] Automatically create customer profile
- [x] Redirect to login or dashboard after successful registration

Implementation verified with backend tests and frontend build. Live MongoDB persistence and unique-index creation remain unverified. The User record is the customer profile.

### 1.2 Customer Login

- [x] Login using email and password
- [x] Validate credentials
- [x] Display invalid-login feedback
- [x] Remember authenticated session
- [x] Logout
- [x] Forgot password and reset password
- [x] Automatically identify customer role
- [x] Redirect to Customer Dashboard

Implemented role-aware routing, 24-hour or optional 30-day HTTP-only sessions, account lockout protection, logout and SMTP-based single-use password reset. Set up SMTP to deliver reset emails; see `backend/AUTH_SETUP.md`. Browser verification used a temporary in-memory test account. Live MongoDB and real email delivery have not been verified.

### 1.3 Customer Dashboard

- [x] Display customer name and profile summary
- [x] Display registered vehicles
- [x] Display active service/repair
- [x] Display current repair status
- [x] Display estimated completion date/time
- [x] Display upcoming appointment
- [x] Display latest invoice
- [x] Display unread messages and notifications
- [x] Provide quick access to Book Appointment, Track Repair and My Vehicles
- [x] Show summary cards for vehicles, active repairs, appointments and outstanding invoices

Implementation uses customer-scoped dashboard data from the authenticated session, including live database query logic for counts, repairs, appointments, invoices, vehicles, notifications and unread messages. Production build and changed-file lint passed. Connected database records were not verified.

### 1.4 Vehicle Management

- [x] Add vehicle
- [x] Edit vehicle details
- [x] View vehicle
- [x] Remove vehicle if permitted
- [x] Search vehicle
- [x] View vehicle service history
- [x] Store registration number, make, model, year, fuel type, mileage, VIN/chassis number and optional vehicle image

Customer-scoped vehicle list and CRUD, profile, and per-vehicle service history are implemented. Delete is blocked when appointments or repair records exist. Production build and changed-file lint passed; connected database records were not verified.

### 1.5 Vehicle Profile

- [x] View complete vehicle information
- [x] View current repair
- [x] View previous services and repairs
- [x] View invoices
- [x] View service recommendations
- [x] View last-service mileage
- [x] View next recommended service
- [x] View repair/service documents

The profile reads only the signed-in customer's vehicle, jobs, appointments and invoices. ServiceJob now supports service mileage, recommendations and document links. These sections show an explicit empty state until workshop records include those values; document viewing supports HTTPS links. Production build, targeted lint and backend syntax checks passed. Connected database records were not verified.

### 1.6 Book Service Appointment

- [ ] Select registered vehicle
- [ ] Select service type
- [ ] Select preferred date and time
- [ ] View available dates and time slots
- [ ] Disable unavailable slots
- [ ] Enter service problem/description
- [ ] Add customer notes
- [ ] Confirm appointment
- [ ] Generate appointment ID
- [ ] Show booking confirmation
- [ ] Send appointment notification

### 1.7 Appointment Management

- [ ] View upcoming appointments
- [ ] View previous appointments
- [ ] View appointment details and status
- [ ] Cancel appointment
- [ ] Request appointment rescheduling
- [ ] Receive appointment confirmation and reminders
- [ ] View assigned technician when available
- [ ] Support statuses: Pending, Confirmed, Checked In, In Service, Completed and Cancelled

### 1.8 Live Repair Tracking

- [ ] View active service job and service number
- [ ] View vehicle and assigned technician
- [ ] View current repair status
- [ ] View progress timeline
- [ ] View technician updates and timestamps
- [ ] View estimated completion time
- [ ] View completed and pending tasks
- [ ] Track the four main stages: Inspecting, In Progress, Final Test and Ready

### 1.9 Additional Repair Approval

- [ ] Receive repair approval request
- [ ] View identified problem and technician explanation
- [ ] View repair photos if uploaded
- [ ] View required parts and estimated part/labour costs
- [ ] View total additional cost
- [ ] Approve or decline additional repair
- [ ] Add customer comments
- [ ] Record decision date/time
- [ ] Notify technician/admin after decision
- [ ] Support statuses: Pending, Approved and Rejected

### 1.10 Customer Messaging

- [ ] Message service manager/workshop
- [ ] Receive messages
- [ ] Send text messages
- [ ] View conversation history and timestamps
- [ ] Link conversation to service job
- [ ] Open repair approval links from messages
- [ ] Mark messages as read
- [ ] Receive new-message notification

### 1.11 Customer Notifications

- [ ] Appointment confirmation
- [ ] Appointment reminder
- [ ] Vehicle checked-in notification
- [ ] Inspection completed notification
- [ ] Repair started notification
- [ ] Approval-request notification
- [ ] Final-test notification
- [ ] Vehicle-ready notification
- [ ] Invoice notification
- [ ] Payment confirmation
- [ ] Mark notification as read
- [ ] Mark all notifications as read

### 1.12 Service History

- [ ] View all previous services
- [ ] Filter by vehicle
- [ ] Search service records
- [ ] View service date, service number and service type
- [ ] View technician and mileage
- [ ] View replaced parts and completed work
- [ ] View final cost and corresponding invoice
- [ ] Download service record

### 1.13 Customer Invoice

- [ ] View invoice and invoice number
- [ ] View service/job number
- [ ] View parts and labour charges
- [ ] View taxes and discounts
- [ ] View total amount
- [ ] View payment status
- [ ] Download or print invoice
- [ ] Proceed to payment

### 1.14 Customer Payment

- [ ] Select invoice
- [ ] View amount due
- [ ] Choose payment method
- [ ] Make payment
- [ ] Record transaction reference
- [ ] Update invoice payment status
- [ ] Show success/failure feedback
- [ ] Generate and download receipt


## 2. Appointment Scheduling & Technician Allocation

### 2.1 Admin Login

- [ ] Admin authentication
- [ ] Validate credentials
- [ ] Identify admin/service-manager role
- [ ] Secure session
- [ ] Logout
- [ ] Forgot/change password
- [ ] Redirect to Admin Dashboard

### 2.2 Admin Dashboard

- [ ] View today's, pending and upcoming appointments
- [ ] View active workshop jobs
- [ ] View vehicles in workshop
- [ ] View available and busy technicians
- [ ] View jobs awaiting approval
- [ ] View jobs in Final Test and Ready stages
- [ ] View daily revenue summary
- [ ] View recent workshop activity
- [ ] KPI cards for appointments, Inspecting, In Progress, Final Test, Ready and technician availability

### 2.3 Appointment Calendar

- [ ] Daily, weekly and monthly calendar views
- [ ] Search appointments
- [ ] Filter by status, technician and date
- [ ] View available slots
- [ ] Identify overlapping bookings
- [ ] View workshop capacity and booked time slots

### 2.4 Create Appointment

- [ ] Select existing customer or add new customer
- [ ] Select or add vehicle
- [ ] Select service
- [ ] Select date and time
- [ ] Check slot availability
- [ ] Enter customer complaint
- [ ] Add internal notes
- [ ] Confirm booking
- [ ] Generate appointment ID
- [ ] Notify customer

### 2.5 Manage Appointment

- [ ] View appointment details
- [ ] Confirm, edit, reschedule or cancel appointment
- [ ] Change appointment status
- [ ] Mark customer as arrived
- [ ] Convert appointment into service job
- [ ] Assign technician

### 2.6 Customer Management

- [ ] Add, view and edit customer
- [ ] Search customer
- [ ] View phone and email
- [ ] View customer vehicles
- [ ] View service history
- [ ] View appointments and current jobs
- [ ] View invoices and outstanding payments

### 2.7 Vehicle Management

- [ ] Add and edit vehicle
- [ ] Search by registration number or customer
- [ ] View vehicle details
- [ ] View service history
- [ ] View active and previous jobs
- [ ] View invoices

### 2.8 Service Type Management

- [ ] Add service type
- [ ] Edit service type
- [ ] Delete or deactivate service type
- [ ] Define service name
- [ ] Define default duration
- [ ] Define estimated service cost
- [ ] Define required technician skill
- [ ] Maintain examples such as Full Service, Oil Change, Brake Service, Engine Diagnosis and Electrical Diagnosis

### 2.9 Technician Management

- [ ] Add and edit technician profile
- [ ] View technician and specialization
- [ ] Set technician availability
- [ ] View work schedule
- [ ] View assigned and completed jobs
- [ ] View technician workload

### 2.10 Technician Availability

- [ ] Set Available status
- [ ] Set Busy status
- [ ] Set Break status
- [ ] Set Off Duty status
- [ ] Set Leave status
- [ ] Prevent assignment when technician is unavailable

### 2.11 Technician Allocation

- [ ] View unassigned jobs
- [ ] View available technicians
- [ ] View specialization and workload
- [ ] View number of jobs assigned today
- [ ] Assign, reassign or remove technician
- [ ] Notify technician
- [ ] Record assignment time

### 2.12 Job Creation / Allocation

- [ ] Convert confirmed appointment into service job
- [ ] Generate Service Job ID
- [ ] Attach customer, vehicle and service request
- [ ] Assign technician
- [ ] Set job priority
- [ ] Set expected completion time
- [ ] Add initial customer complaint
- [ ] Set initial repair status to Inspecting

### 2.13 Workshop Job Board

- [ ] View all jobs in Kanban/workflow view
- [ ] Filter by status, technician, date and priority
- [ ] Search service number or vehicle registration
- [ ] Use columns: Inspecting, In Progress, Final Test and Ready

### 2.14 Appointment Notifications

- [ ] Send booking confirmation
- [ ] Send rescheduling notification
- [ ] Send cancellation notification
- [ ] Send appointment reminder
- [ ] Send technician-assignment notification when required
- [ ] Send check-in confirmation


## 3. Job Allocation & Technician Report

### 3.1 Technician Login

- [ ] Login and authenticate technician
- [ ] Identify technician role
- [ ] Secure technician session
- [ ] Logout
- [ ] Change password

### 3.2 Technician Dashboard

- [ ] View assigned jobs
- [ ] View today's jobs
- [ ] View pending jobs
- [ ] View current active job
- [ ] View completed jobs
- [ ] View high-priority jobs
- [ ] View notifications
- [ ] Show indicators for Assigned, In Progress, Waiting for Approval and Completed Today

### 3.3 My Jobs

- [ ] View assigned jobs
- [ ] Search jobs
- [ ] Filter and sort jobs
- [ ] Open job
- [ ] View job priority
- [ ] View expected completion time
- [ ] View service type

### 3.4 Digital Job Card

- [ ] View Service Job ID
- [ ] View customer complaint
- [ ] View vehicle details
- [ ] View appointment information
- [ ] View assigned technician and current status
- [ ] Record inspection and diagnosis
- [ ] Add repair notes
- [ ] Add parts
- [ ] Update tasks
- [ ] Record labour hours
- [ ] Upload photos
- [ ] Request customer approval
- [ ] Update job status

### 3.5 Vehicle Inspection

- [ ] Start inspection
- [ ] Record inspection findings
- [ ] Add diagnostic result
- [ ] Identify issues
- [ ] Add recommended repairs
- [ ] Add inspection notes
- [ ] Upload inspection images
- [ ] Complete inspection

### 3.6 Diagnostic Report

- [ ] Enter diagnostic result
- [ ] Select issue category
- [ ] Describe fault
- [ ] Enter recommended action
- [ ] Set severity/priority
- [ ] Add estimated repair time
- [ ] Save and update diagnosis

### 3.7 Repair Task Checklist

- [ ] View tasks
- [ ] Add and edit task
- [ ] Mark task Pending, In Progress or Complete
- [ ] Add task notes
- [ ] Record completion time

### 3.8 Parts Usage

- [ ] Search spare part
- [ ] Select part
- [ ] Enter quantity
- [ ] Add part to job
- [ ] Remove incorrect item
- [ ] View unit price
- [ ] Calculate parts cost
- [ ] Record used parts

### 3.9 Labour Tracking

- [ ] Start work timer
- [ ] Stop timer
- [ ] Add manual labour time
- [ ] View total labour time
- [ ] Add labour type
- [ ] Calculate labour charge
- [ ] Record technician labour

### 3.10 Additional Repair Request

- [ ] Identify additional problem
- [ ] Enter repair description and reason
- [ ] Add parts and labour estimate
- [ ] Calculate estimated additional cost
- [ ] Upload supporting image
- [ ] Send request for customer approval
- [ ] Set job/repair request to Waiting for Customer Approval

### 3.11 View Customer Approval

- [ ] View pending request
- [ ] View approval result
- [ ] View customer comment
- [ ] Continue job when approved
- [ ] Mark related task cancelled when rejected
- [ ] Record decision in job history

### 3.12 Repair Status Update

- [ ] Change status to Inspecting
- [ ] Change status to In Progress
- [ ] Change status to Final Test
- [ ] Change status to Ready
- [ ] Enter customer-facing update
- [ ] Record status timestamp
- [ ] Notify customer automatically

### 3.13 Upload Repair Evidence

- [ ] Upload before-repair photo
- [ ] Upload damaged-part photo
- [ ] Upload after-repair photo
- [ ] Add image description
- [ ] Link evidence to job
- [ ] View uploaded evidence

### 3.14 Final Testing

- [ ] Start final test
- [ ] Complete final checklist
- [ ] Record test results
- [ ] Add final notes
- [ ] Identify unresolved issue
- [ ] Return job to In Progress when required
- [ ] Approve vehicle as Ready

### 3.15 Complete Job

- [ ] Verify all tasks are complete
- [ ] Verify used parts and labour hours
- [ ] Save final technician report
- [ ] Change status to Ready
- [ ] Notify admin and customer
- [ ] Send completed job information to billing module

### 3.16 Technician Job History

- [ ] View completed jobs
- [ ] Search completed jobs
- [ ] View job card
- [ ] View diagnosis and repair tasks
- [ ] View parts used and labour time
- [ ] View completion date


## 4. Billing & Revenue Report

### 4.1 Billing Dashboard

- [ ] View today's revenue
- [ ] View monthly revenue
- [ ] View total invoices
- [ ] View paid, pending and overdue invoices
- [ ] View outstanding value
- [ ] View recent payments
- [ ] View revenue graph

### 4.2 Generate Invoice

- [ ] Generate invoice from completed job
- [ ] Generate unique invoice number
- [ ] Import customer and vehicle details
- [ ] Import Service Job ID
- [ ] Import used parts and labour hours
- [ ] Import approved additional repairs
- [ ] Calculate parts cost, labour cost and subtotal
- [ ] Apply discount and tax
- [ ] Calculate final amount
- [ ] Save and preview invoice
- [ ] Generate finalized invoice

### 4.3 Invoice Management

- [ ] View and search invoice
- [ ] Edit draft invoice
- [ ] Delete draft invoice
- [ ] Finalize invoice
- [ ] Print invoice
- [ ] Download PDF invoice
- [ ] Send invoice to customer
- [ ] View payment status
- [ ] Support statuses: Draft, Pending, Partially Paid, Paid, Overdue and Cancelled

### 4.4 Payment Processing

- [ ] Select invoice
- [ ] View outstanding balance
- [ ] Record payment
- [ ] Choose payment method
- [ ] Support cash, card and online payment
- [ ] Record payment reference
- [ ] Process transaction
- [ ] Update invoice status
- [ ] Generate and send receipt

### 4.5 Payment History

- [ ] View all payments
- [ ] Search payment
- [ ] Filter by date and payment method
- [ ] View transaction ID
- [ ] View customer and invoice
- [ ] View amount, payment date and status

### 4.6 Outstanding Payments

- [ ] View unpaid invoices
- [ ] View overdue invoices
- [ ] View customer details
- [ ] View overdue duration
- [ ] Send payment reminder
- [ ] Mark manually paid invoice
- [ ] View total outstanding amount

### 4.7 Revenue Reports

- [ ] Daily revenue report
- [ ] Weekly revenue report
- [ ] Monthly revenue report
- [ ] Annual revenue report
- [ ] Custom date-range report
- [ ] Revenue comparison
- [ ] Revenue trend graph
- [ ] Total revenue
- [ ] Average invoice value

### 4.8 Revenue by Service

- [ ] View revenue from Full Service
- [ ] View revenue from Oil Changes
- [ ] View revenue from Brake Repairs
- [ ] View revenue from Engine Repairs
- [ ] View revenue from Electrical Repairs
- [ ] Identify highest-earning service

### 4.9 Parts Revenue / Cost Report

- [ ] View parts sold/used
- [ ] View quantities used
- [ ] View parts revenue
- [ ] View parts cost
- [ ] View most-used parts
- [ ] Filter by date

### 4.10 Technician Revenue / Productivity Report

- [ ] View jobs completed by technician
- [ ] View labour hours
- [ ] View revenue generated
- [ ] View average completion time
- [ ] Filter by technician and reporting period

### 4.11 Financial Export

- [ ] Export revenue report as PDF
- [ ] Export report as Excel
- [ ] Print report
- [ ] Download invoice report
- [ ] Download payment report
- [ ] Download outstanding-payment report


## 5. Shared System Functions

### 5.1 Authentication & Role-Based Access Control

- [ ] Roles: Customer, Admin/Service Manager, Technician and Finance/Admin
- [ ] Role-based authentication and authorization
- [ ] Login and logout
- [ ] Password reset
- [ ] Session management
- [ ] User profile management
- [ ] Restrict screens and actions according to role

### 5.2 Notification Engine

- [ ] Appointment created -> customer notification
- [ ] Technician assigned -> technician notification
- [ ] Repair status updated -> customer notification
- [ ] Additional repair found -> customer approval request
- [ ] Customer approves/rejects -> technician/admin notification
- [ ] Vehicle ready -> customer notification
- [ ] Invoice generated -> customer notification
- [ ] Payment completed -> customer and admin confirmation

### 5.3 Search, Filters & Audit Trail

- [ ] Global or module-specific search where appropriate
- [ ] Filter records by date, status, vehicle, customer, technician and service type
- [ ] Record important status changes with timestamps
- [ ] Record user who performed important administrative changes
- [ ] Maintain job and approval histories
