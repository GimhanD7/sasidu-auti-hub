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

- [x] Select registered vehicle
- [x] Select service type
- [x] Select preferred date and time
- [x] View available dates and time slots
- [x] Disable unavailable slots
- [x] Enter service problem/description
- [x] Add customer notes
- [x] Confirm appointment
- [x] Generate appointment ID
- [x] Show booking confirmation
- [x] Send appointment notification

Customer-scoped booking validates vehicle ownership and service fields, shows availability in 14-day ranges, and prevents duplicate active bookings for a slot with a unique database key. New bookings receive a generated appointment number and an in-app notification. Daily times and business weekdays are configurable; default capacity is one booking per slot. Production build, changed-file lint and backend syntax checks passed. Connected database/index creation and external email/SMS delivery were not verified.

### 1.7 Appointment Management

- [x] View upcoming appointments
- [x] View previous appointments
- [x] View appointment details and status
- [x] Cancel appointment
- [x] Request appointment rescheduling
- [x] Receive appointment confirmation and reminders
- [x] View assigned technician when available
- [x] Support statuses: Pending, Confirmed, Checked In, In Service, Completed and Cancelled

Customer appointment management lists upcoming and past/cancelled bookings with details and assigned technician, permits cancellation of future Pending/Confirmed bookings, and stores reschedule requests for workshop review without releasing or moving the original slot. Confirmation notifications are created when bookings are submitted and when staff saves a Confirmed status. The backend reminder scheduler sends an idempotent in-app reminder before Pending/Confirmed appointments; set `TZ` to the workshop timezone. Production build, changed-file lint and backend syntax checks passed. Connected database execution and external email/SMS delivery were not verified.

### 1.8 Live Repair Tracking

- [x] View active service job and service number
- [x] View vehicle and assigned technician
- [x] View current repair status
- [x] View progress timeline
- [x] View technician updates and timestamps
- [x] View estimated completion time
- [x] View completed and pending tasks
- [x] Track the four main stages: Inspecting, In Progress, Final Test and Ready

Customer repair tracking is restricted to the signed-in customer's jobs and refreshes automatically every 30 seconds. It shows service and vehicle details, technician, current status, four-stage progress, recorded updates and task completion, ETA, approval-waiting and Ready notices. Existing jobs without task or timeline records display an empty state for that section. Build, targeted lint and backend syntax checks passed; connected database records were not verified.

### 1.9 Additional Repair Approval

- [x] Receive repair approval request
- [x] View identified problem and technician explanation
- [x] View repair photos if uploaded
- [x] View required parts and estimated part/labour costs
- [x] View total additional cost
- [x] Approve or decline additional repair
- [x] Add customer comments
- [x] Record decision date/time
- [x] Notify technician/admin after decision
- [x] Support statuses: Pending, Approved and Rejected

Customers can review and decide on pending additional repairs from the approval page, with optional comments and a timestamped decision history. The customer-scoped API stores compatible parts/labour estimates and photo links, advances a paused job when no requests remain pending, and notifies the assigned technician and active admins after a decision. Production build, targeted lint, backend syntax checks and diff checks passed; connected database behavior and notification delivery were not verified.

### 1.10 Customer Messaging

- [x] Message service manager/workshop
- [x] Receive messages
- [x] Send text messages
- [x] View conversation history and timestamps
- [x] Link conversation to service job
- [x] Open repair approval links from messages
- [x] Mark messages as read
- [x] Receive new-message notification

Customer, admin and assigned-technician conversations are scoped to accessible service jobs. Messages are timestamped, automatically refresh while open, mark incoming messages as read, and create in-app notifications for the other party/workshop. Approval links in messages and pending-approval shortcuts open the customer approval page. Production build, targeted lint, backend syntax and diff checks passed; connected database and live notification behavior were not verified.

### 1.11 Customer Notifications

- [x] Appointment confirmation
- [x] Appointment reminder
- [x] Vehicle checked-in notification
- [x] Inspection completed notification
- [x] Repair started notification
- [x] Approval-request notification
- [x] Final-test notification
- [x] Vehicle-ready notification
- [x] Invoice notification
- [x] Payment confirmation
- [x] Mark notification as read
- [x] Mark all notifications as read

The customer notification inbox lists recent events, filters unread items, marks one or all read, and links to the relevant customer page. Appointment confirmation/reminder and check-in, repair milestones/approval requests, invoice creation and payment confirmation create in-app notifications through their model or scheduler events. Production build, targeted lint, backend syntax and diff checks passed; live database and event delivery were not verified.

### 1.12 Service History

- [x] View all previous services
- [x] Filter by vehicle
- [x] Search service records
- [x] View service date, service number and service type
- [x] View technician and mileage
- [x] View replaced parts and completed work
- [x] View final cost and corresponding invoice
- [x] Download service record

Customer service history is restricted to the signed-in customer's vehicles and jobs. It supports vehicle filtering and text search, shows completed tasks, replaced parts, timeline, technician, mileage and invoice breakdown, and downloads a per-job text record. The service job model now supports itemized replaced parts; older records without task or parts data display that detail as unrecorded. Production build, targeted lint, backend syntax and diff checks passed; connected database records were not verified.

### 1.13 Customer Invoice

- [x] View invoice and invoice number
- [x] View service/job number
- [x] View parts and labour charges
- [x] View taxes and discounts
- [x] View total amount
- [x] View payment status
- [x] Download or print invoice
- [x] Proceed to payment

Customers can access non-draft invoices scoped to their account, review job/vehicle information and charge breakdowns, and print or save an individual invoice as PDF. Outstanding invoices link to the payment flow route, which is completed in function 1.14. Invoice records now support optional itemized parts and labour lines while retaining aggregate totals for existing records. Production build, targeted lint, backend syntax and diff checks passed; connected invoice data was not verified.

### 1.14 Customer Payment

- [x] Select invoice
- [x] View amount due
- [x] Choose payment method
- [x] Make payment
- [x] Record transaction reference
- [x] Update invoice payment status
- [x] Show success/failure feedback
- [x] Generate and download receipt

Customers can submit the outstanding amount for a bank transfer or pay-at-workshop request, receive an acknowledgment, and download a receipt. Finance can confirm or reject submissions; confirmation updates the invoice and issues a final receipt/notification, while rejection leaves the invoice outstanding and gives the customer feedback. There is no configured card/payment gateway, so this version records off-platform payments and requires Finance verification rather than charging a card. Production build, targeted lint, backend syntax and diff checks passed; connected database and end-to-end payment review were not verified.


## 2. Appointment Scheduling & Technician Allocation

### 2.1 Admin Login

- [x] Admin authentication — dedicated `/admin/login` page and `/api/auth/admin/login` endpoint
- [x] Validate credentials — same email/mobile and password checks as standard login
- [x] Identify admin/service-manager role — backend accepts Admin (including legacy `admin`) only; other roles are rejected
- [x] Secure session — successful login creates the existing secure, httpOnly session cookie
- [x] Logout — existing shared logout invalidates the session
- [x] Forgot/change password — shared forgot/reset password flow applies to admin accounts
- [x] Redirect to Admin Dashboard — successful admin sign-in routes to `/admin/dashboard`

### 2.2 Admin Dashboard

- [x] View today's, pending and upcoming appointments
- [x] View active workshop jobs
- [x] View vehicles in workshop
- [x] View available and busy technicians
- [x] View jobs awaiting approval
- [x] View jobs in Final Test and Ready stages
- [x] View daily revenue summary
- [x] View recent workshop activity
- [x] KPI cards for appointments, Inspecting, In Progress, Final Test, Ready and technician availability

The Admin dashboard now loads live, role-protected data from `/api/admin/dashboard`; technician availability and in-workshop vehicles are derived from active job assignments and job stages. Daily revenue sums Finance-confirmed payments for the current server-local day. Production build and backend syntax checks passed; targeted lint passed with one existing React effect-pattern warning. Connected database records were not verified.

### 2.3 Appointment Calendar

- [x] Daily, weekly and monthly calendar views
- [x] Search appointments
- [x] Filter by status, technician and date
- [x] View available slots
- [x] Identify overlapping bookings
- [x] View workshop capacity and booked time slots

The Admin appointment calendar now queries bookings for the visible date range and provides day, week, and month views, free-text search, and status/technician filters. It shows configured time slots, booked and open capacity, and flags multiple active appointments assigned to the same date/time slot as conflicts. Production build, targeted lint, backend syntax, and diff checks passed; live database data was not verified.

### 2.4 Create Appointment

- [x] Select existing customer or add new customer
- [x] Select or add vehicle
- [x] Select service
- [x] Select date and time
- [x] Check slot availability
- [x] Enter customer complaint
- [x] Add internal notes
- [x] Confirm booking
- [x] Generate appointment ID
- [x] Notify customer

Admins can create a booking from the calendar with an existing or new customer and vehicle. The server validates service, business date, configured time, and slot availability again on submit; it stores customer complaint and staff-only internal notes, generates an appointment number, and creates an in-app notification. For a newly created customer, an account setup email is sent when SMTP is configured. New-customer and vehicle records are cleaned up if the appointment save fails. Production build, targeted lint, backend syntax, and diff checks passed; connected database and mail delivery were not verified.

### 2.5 Manage Appointment

- [x] View appointment details
- [x] Confirm, edit, reschedule or cancel appointment
- [x] Change appointment status
- [x] Mark customer as arrived
- [x] Convert appointment into service job
- [x] Assign technician

Admins can open a booking to review customer contact details, vehicle identifiers, complaint, and staff-only notes; edit appointment details, confirm/cancel/change status, reschedule, mark arrival, and assign a technician. Customer reschedule requests are marked approved when the requested slot is accepted, or rejected when a different slot is saved. A checked-in appointment can be converted once into a linked service job; the job receives the assigned technician and the appointment moves to In Service. Production build, targeted lint, backend syntax, and diff checks passed; live database workflow was not verified.

### 2.6 Customer Management

- [x] Add, view and edit customer
- [x] Search customer
- [x] View phone and email
- [x] View customer vehicles
- [x] View service history
- [x] View appointments and current jobs
- [x] View invoices and outstanding payments

The Admin customer directory supports name/email/mobile search, customer creation, and contact detail edits. Each profile summarizes contact information, vehicles, appointments, active jobs, service history, invoices, and outstanding balances. New accounts receive a secure generated credential and a password setup email when SMTP is configured. Production build, targeted lint, backend syntax, and diff checks passed; connected database records and email delivery were not verified.

### 2.7 Vehicle Management

- [x] Add and edit vehicle
- [x] Search by registration number or customer
- [x] View vehicle details
- [x] View service history
- [x] View active and previous jobs
- [x] View invoices

The Admin vehicle directory supports search by registration, make/model, or owner details, plus vehicle create/edit with registration, VIN, fuel, mileage, year, and image URL fields. Vehicle profiles show the owner, active and previous jobs, job timelines, appointments, and linked invoices. Ownership reassignment is blocked once appointments or service-job history exist. Production build, targeted lint, backend syntax, and diff checks passed; live records were not verified.

### 2.8 Service Type Management

- [x] Add service type
- [x] Edit service type
- [x] Delete or deactivate service type
- [x] Define service name
- [x] Define default duration
- [x] Define estimated service cost
- [x] Define required technician skill
- [x] Maintain examples such as Full Service, Oil Change, Brake Service, Engine Diagnosis and Electrical Diagnosis

The Admin Service Types page manages active services, duration, estimated cost, and required skill. The catalog starts with Full Service, Oil Change, Brake Service, Engine Diagnosis, Electrical Diagnosis, and General Repair. Deactivation preserves appointment history and removes the service from customer/admin booking choices; the server validates that selected services remain active. Production build, targeted lint, backend syntax, and diff checks passed; database-backed records were not verified.

### 2.9 Technician Management

- [x] Add and edit technician profile
- [x] View technician and specialization
- [x] Set technician availability
- [x] View work schedule
- [x] View assigned and completed jobs
- [x] View technician workload

The Admin technician directory supports profile creation/editing, specialization, working days and hours, and workload summaries. Technician profiles show assigned appointments and jobs, including active and Ready jobs. New accounts use the password setup email when SMTP is configured. Production build, targeted lint, backend syntax, and diff checks passed; live database records and email delivery were not verified. Availability status controls (Available, Busy, Break, Off Duty, Leave) remain in section 2.10.

### 2.10 Technician Availability

- [x] Set Available status
- [x] Set Busy status
- [x] Set Break status
- [x] Set Off Duty status
- [x] Set Leave status
- [x] Prevent assignment when technician is unavailable

Technician availability can be updated from the Admin technician directory or profile. Appointment assignment and appointment-to-job conversion reject new assignments unless the selected technician is Available; an existing assignment remains editable when the assigned technician’s status later changes. The Admin dashboard reports stored technician statuses. Production build, targeted lint, backend syntax, and diff checks passed; live database records were not verified.

### 2.11 Technician Allocation

- [x] View unassigned jobs
- [x] View available technicians
- [x] View specialization and workload
- [x] View number of jobs assigned today
- [x] Assign, reassign or remove technician
- [x] Notify technician
- [x] Record assignment time

The Admin Job Allocation page lists open work and technician availability, specialization, active workload, and assignments made today. Admins can assign, reassign, or unassign a job; only Available technicians can receive new work. Each change records the technician, assigning admin, action, and timestamp, keeps the linked appointment assignment in sync, and notifies affected technicians. Production build, targeted lint, backend syntax, and diff checks passed; live database records and notification delivery were not verified.

### 2.12 Job Creation / Allocation

- [x] Convert confirmed appointment into service job
- [x] Generate Service Job ID
- [x] Attach customer, vehicle and service request
- [x] Assign technician
- [x] Set job priority
- [x] Set expected completion time
- [x] Add initial customer complaint
- [x] Set initial repair status to Inspecting

Appointment conversion accepts Confirmed or Checked In appointments, preserves the linked customer, vehicle, and service request, and creates an Inspecting job with a generated service number. Admins choose priority and may set an expected completion time before conversion; the complaint is copied onto the job. Technician availability is checked, assignment history is recorded, and the technician receives a notification. Production build, targeted lint, backend syntax, and diff checks passed; live database records and notification delivery were not verified.

### 2.13 Workshop Job Board

- [x] View all jobs in Kanban/workflow view
- [x] Filter by status, technician, date and priority
- [x] Search service number or vehicle registration
- [x] Use columns: Inspecting, In Progress, Final Test and Ready

Replaced the sample-data board with live service jobs, including the Waiting for Approval stage. Admins can filter by status, technician (including unassigned), priority, and job creation date range, and search by service number or vehicle registration. Cards show customer, vehicle, service, technician, priority, complaint, and expected completion. Production build, targeted lint, backend syntax, and diff checks passed; live database records were not verified.

### 2.14 Appointment Notifications

- [x] Send booking confirmation
- [x] Send rescheduling notification
- [x] Send cancellation notification
- [x] Send appointment reminder
- [x] Send technician-assignment notification when required
- [x] Send check-in confirmation

Appointment events create in-app notifications for customers, admins, and technicians as appropriate. Admins can explicitly approve or reject a customer reschedule request; approval checks the slot again and rejection tells the customer the original booking remains. Reminder scheduling uses the configured workshop timezone (`APPOINTMENT_TIME_ZONE`, default `Asia/Colombo`) and avoids marking a reminder sent if the appointment changed during delivery. SMS and email notifications are not configured. Production build, targeted lint, backend syntax, and diff checks passed; live notification delivery was not verified.


## 3. Job Allocation & Technician Report

### 3.1 Technician Login

- [x] Login and authenticate technician
- [x] Identify technician role
- [x] Secure technician session
- [x] Logout
- [x] Change password

Added a technician-only sign-in route with server-side role enforcement, HttpOnly session cookies, and protected logout. Technicians can change their password after verifying the current password; password changes revoke every active session and require signing in again. The backend auth integration tests, frontend production build, targeted lint, syntax checks, and diff checks passed. Live account behavior was not verified against a connected database.

### 3.2 Technician Dashboard

- [x] View assigned jobs
- [x] View today's jobs
- [x] View pending jobs
- [x] View current active job
- [x] View completed jobs
- [x] View high-priority jobs
- [x] View notifications
- [x] Show indicators for Assigned, In Progress, Waiting for Approval and Completed Today

Replaced the sample dashboard with live, technician-scoped job and notification data. The dashboard shows assigned, today’s, pending, active, completed, and high-priority jobs, with status indicators and unread notification count; today and completed-today use the configured workshop timezone. Backend integration tests (including role access and dashboard data), production build, targeted lint, syntax checks, and diff checks passed. Live database content was not verified.

### 3.3 My Jobs

- [x] View assigned jobs
- [x] Search jobs
- [x] Filter and sort jobs
- [x] Open job
- [x] View job priority
- [x] View expected completion time
- [x] View service type

Added a technician-only My Jobs page with search across service number, vehicle registration, and complaint; status and priority filters; sort order; and pagination. Opening a job shows its priority, expected completion, service type, customer, vehicle, appointment, and status history. Both list and detail endpoints scope every query to the signed-in technician. Backend integration tests, frontend production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.4 Digital Job Card

- [x] View Service Job ID
- [x] View customer complaint
- [x] View vehicle details
- [x] View appointment information
- [x] View assigned technician and current status
- [x] Record inspection and diagnosis
- [x] Add repair notes
- [x] Add parts
- [x] Update tasks
- [x] Record labour hours
- [x] Upload photos
- [x] Request customer approval
- [x] Update job status

Expanded the technician job detail into an editable digital card with inspection findings and diagnosis, issues and recommendations, repair notes, task tracking, replaced parts, manual labour entries, private photo attachments, customer approval requests, and guarded job status transitions. Mutations and photo reads are limited to the technician assigned to the job; uploads accept verified JPEG, PNG, or WebP images up to 1.4 MB each, with a 12-photo cap. Backend integration tests cover job-card updates and uploads, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.5 Vehicle Inspection

- [x] Start inspection
- [x] Record inspection findings
- [x] Add diagnostic result
- [x] Identify issues
- [x] Add recommended repairs
- [x] Add inspection notes
- [x] Upload inspection images
- [x] Complete inspection

Added an explicit inspection start step and audit history. Technicians can save findings, diagnosis, issues, repair recommendations, and notes; attach inspection-only images; and complete the inspection after entering findings and a diagnosis. Repair work cannot start until inspection is complete, and inspection photos cannot be added afterward. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

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
