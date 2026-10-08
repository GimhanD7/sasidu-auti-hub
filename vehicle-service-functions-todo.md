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

- [x] Enter diagnostic result
- [x] Select issue category
- [x] Describe fault
- [x] Enter recommended action
- [x] Set severity/priority
- [x] Add estimated repair time
- [x] Save and update diagnosis

Added a structured diagnostic report separate from the inspection record. Technicians can save and update the result, select an issue category, describe the fault and recommended action, set severity, and estimate repair hours; updates are timestamped in the job history. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.7 Repair Task Checklist

- [x] View tasks
- [x] Add and edit task
- [x] Mark task Pending, In Progress or Complete
- [x] Add task notes
- [x] Record completion time

Completed the job-card task checklist with task title and note editing, status changes between Pending, In Progress, and Complete, and a completion timestamp when marked complete. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.8 Parts Usage

- [x] Search spare part
- [x] Select part
- [x] Enter quantity
- [x] Add part to job
- [x] Remove incorrect item
- [x] View unit price
- [x] Calculate parts cost
- [x] Record used parts

Added part search using previously recorded part names, numbers, and unit prices; selecting a match fills the usage form, with manual entry available for new parts. Technicians can record quantity, add or remove part entries, see unit prices and line totals, and view the calculated job parts total. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.9 Labour Tracking

- [x] Start work timer
- [x] Stop timer
- [x] Add manual labour time
- [x] View total labour time
- [x] Add labour type
- [x] Calculate labour charge
- [x] Record technician labour

Added server-timestamped labour timers with technician ownership, duplicate-start protection, and elapsed-time recording on stop. Manual entries and timer entries include labour type, technician, duration, and hourly rate; the job card shows total hours and calculated charges. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.10 Additional Repair Request

- [x] Identify additional problem
- [x] Enter repair description and reason
- [x] Add parts and labour estimate
- [x] Calculate estimated additional cost
- [x] Upload supporting image
- [x] Send request for customer approval
- [x] Set job/repair request to Waiting for Customer Approval

Expanded technician approval requests to itemize up to 20 parts, enter a labour estimate, calculate the total server-side, and attach up to three supporting images for the customer. Customers can view the authenticated images in their approval screen; submitted requests are recorded as Pending and move the job to Waiting for Approval. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.11 View Customer Approval

- [x] View pending request
- [x] View approval result
- [x] View customer comment
- [x] Continue job when approved
- [x] Mark related task cancelled when rejected
- [x] Record decision in job history

Linked optional repair tasks to approval requests and surfaced pending/approved/rejected states, customer comments, decision times, and linked task titles in the technician job card. Customer decisions are saved to job history; approvals resume the job once no requests remain pending, while rejection cancels its linked task. Added integration coverage for pending, rejected, and approved decisions. Backend tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.12 Repair Status Update

- [x] Change status to Inspecting
- [x] Change status to In Progress
- [x] Change status to Final Test
- [x] Change status to Ready
- [x] Enter customer-facing update
- [x] Record status timestamp
- [x] Notify customer automatically

Added a required customer-facing note to each technician status transition. The note is saved with the timestamp in the job timeline, shown in customer repair tracking, and included in automatic customer status notifications. Existing workflow gates still enforce inspection, approvals, and completed or cancelled tasks. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.13 Upload Repair Evidence

- [x] Upload before-repair photo
- [x] Upload damaged-part photo
- [x] Upload after-repair photo
- [x] Add image description
- [x] Link evidence to job
- [x] View uploaded evidence

Added typed repair evidence for Before Repair, Damaged Part, and After Repair, with a required image description. Evidence stays linked to the job, follows stage-specific workflow rules, and appears in the technician job card with its description and upload time. Existing customer approval evidence remains separately tagged and shared through the approval view. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.14 Final Testing

- [x] Start final test
- [x] Complete final checklist
- [x] Record test results
- [x] Add final notes
- [x] Identify unresolved issue
- [x] Return job to In Progress when required
- [x] Approve vehicle as Ready

Added a final-test workflow with required checks for brakes, steering, lights and signals, tyres and wheels, fluid leaks, and road test. Technicians can record pass/fail results, per-check notes, final notes, and unresolved issues. A failure returns the job to In Progress; Ready is blocked until a completed test passes. Added integration coverage for incomplete, failed, retested, passed, and Ready transitions. Backend tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.15 Complete Job

- [x] Verify all tasks are complete
- [x] Verify used parts and labour hours
- [x] Save final technician report
- [x] Change status to Ready
- [x] Notify admin and customer
- [x] Send completed job information to billing module

Added a guarded Complete Job action requiring a passing final test, all tasks complete or cancelled, no pending approvals or active labour timer, explicit task/parts/labour verification, and a final technician report. Completion marks the vehicle Ready, triggers the existing customer notification, notifies admins, and creates an idempotently reused Draft invoice with parts, labour, and approved additional repair costs for billing review. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.

### 3.16 Technician Job History

- [x] View completed jobs
- [x] Search completed jobs
- [x] View job card
- [x] View diagnosis and repair tasks
- [x] View parts used and labour time
- [x] View completion date

Replaced the Job History placeholder with a technician-scoped completed-jobs page, searchable by service number, vehicle registration, or complaint and paginated. Each result shows its completion timestamp and opens the complete job card with diagnosis, tasks, used parts, and labour records. Added a protected history endpoint and links from the dashboard and My Jobs. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed. Live database records were not verified.


## 4. Billing & Revenue Report

### 4.1 Billing Dashboard

- [x] View today's revenue
- [x] View monthly revenue
- [x] View total invoices
- [x] View paid, pending and overdue invoices
- [x] View outstanding value
- [x] View recent payments
- [x] View revenue graph

Replaced the sample dashboard with live billing metrics for Finance and Admin roles: verified-payment revenue for today and this month, invoice counts by status, outstanding balances, the latest eight payments, and a six-month revenue chart. Values display in LKR, and the dashboard links to payment review. Backend integration tests, production build, targeted lint, syntax checks, and diff checks passed; live database values were not verified.

### 4.2 Generate Invoice

- [x] Generate invoice from completed job
- [x] Generate unique invoice number
- [x] Import customer and vehicle details
- [x] Import Service Job ID
- [x] Import used parts and labour hours
- [x] Import approved additional repairs
- [x] Calculate parts cost, labour cost and subtotal
- [x] Apply discount and tax
- [x] Calculate final amount
- [x] Save and preview invoice
- [x] Generate finalized invoice

Added a Finance invoice-generation page for service jobs at Ready status. The preview imports customer/vehicle details, job number, replaced parts, recorded labour, and customer-approved repairs; staff can enter percentage tax and discount, save a uniquely numbered draft, or finalize and issue it as Pending. Finalized invoices cannot be overwritten through this flow. Backend integration tests verify role-protected job listing, validation, calculations, and finalization; production build, targeted lint, syntax, and diff checks passed. Live database data was not verified.

### 4.3 Invoice Management

- [x] View and search invoice
- [x] Edit draft invoice
- [x] Delete draft invoice
- [x] Finalize invoice
- [x] Print invoice
- [x] Download PDF invoice
- [x] Send invoice to customer
- [x] View payment status
- [x] Support statuses: Draft, Pending, Partially Paid, Paid, Overdue and Cancelled

Added a Finance invoice manager with search by invoice/customer/job/vehicle and status filtering. Finance can edit tax and discount on drafts, delete drafts, issue them, review paid and due amounts, print/save invoices as PDFs, and email issued invoices to the customer when SMTP is configured. Issuing a draft prevents further edits or deletion. Backend integration tests, production build, targeted lint, syntax, and diff checks passed; live database and SMTP delivery were not verified.

### 4.4 Payment Processing

- [x] Select invoice
- [x] View outstanding balance
- [x] Record payment
- [x] Choose payment method
- [x] Support cash, card and online payment
- [x] Record payment reference
- [x] Process transaction
- [x] Update invoice status
- [x] Generate and send receipt

Finance can select an issued invoice with a balance, record full or partial receipts by cash, card, online, bank transfer, or pay-at-workshop, and enter a transaction reference. The server prevents overpayment and stale-balance updates, changes the invoice to Partially Paid or Paid, creates a receipt number, notifies the customer, and emails the receipt when SMTP is configured. Finance can print/save a receipt as PDF if email is unavailable. Backend integration tests, frontend production build, targeted lint, syntax, and diff checks passed; live database, SMTP, and external card/online settlement were not verified. Card and online payments are recorded after settlement outside this app.

### 4.5 Payment History

- [x] View all payments
- [x] Search payment
- [x] Filter by date and payment method
- [x] View transaction ID
- [x] View customer and invoice
- [x] View amount, payment date and status

Added a paginated Finance Payment History view covering all payment records. Staff can search receipt and transaction references, customer name/email, or invoice number, and filter by date range and payment method; each row shows customer, invoice, amount, submission/review date, and payment status. Backend integration tests, production build, targeted lint, syntax, and diff checks passed; live database records were not verified.

### 4.6 Outstanding Payments

- [x] View unpaid invoices
- [x] View overdue invoices
- [x] View customer details
- [x] View overdue duration
- [x] Send payment reminder
- [x] Mark manually paid invoice
- [x] View total outstanding amount

Added an Outstanding Payments view with total balance, unpaid/overdue counts, customer contact details, due dates, and overdue days. Issued invoices receive a 30-day due date; older invoices without one use 30 days from issue as a fallback. Finance can email a payment reminder or record the full remaining amount as manually received, creating a payment and receipt through the standard payment flow. Backend integration tests, production build, targeted lint, syntax, and diff checks passed; live records, SMTP delivery, and automatic background overdue updates were not verified. Overdue status is recalculated when Finance opens this view.

### 4.7 Revenue Reports

- [x] Daily revenue report
- [x] Weekly revenue report
- [x] Monthly revenue report
- [x] Annual revenue report
- [x] Custom date-range report
- [x] Revenue comparison
- [x] Revenue trend graph
- [x] Total revenue
- [x] Average invoice value

### 4.8 Revenue by Service

- [x] View revenue from Full Service
- [x] View revenue from Oil Changes
- [x] View revenue from Brake Repairs
- [x] View revenue from Engine Repairs
- [x] View revenue from Electrical Repairs
- [x] Identify highest-earning service

### 4.9 Parts Revenue / Cost Report

- [x] View parts sold/used
- [x] View quantities used
- [x] View parts revenue
- [x] View parts cost
- [x] View most-used parts
- [x] Filter by date

### 4.10 Technician Revenue / Productivity Report

- [x] View jobs completed by technician
- [x] View labour hours
- [x] View revenue generated
- [x] View average completion time
- [x] Filter by technician and reporting period

### 4.11 Financial Export

- [x] Export revenue report as PDF
- [x] Export report as Excel
- [x] Print report
- [x] Download invoice report
- [x] Download payment report
- [x] Download outstanding-payment report


## 5. Shared System Functions

### 5.1 Authentication & Role-Based Access Control

- [x] Roles: Customer, Admin/Service Manager, Technician and Finance/Admin
- [x] Role-based authentication and authorization
- [x] Login and logout
- [x] Password reset
- [x] Session management
- [x] User profile management
- [x] Restrict screens and actions according to role

### 5.2 Notification Engine

- [x] Appointment created -> customer notification
- [x] Technician assigned -> technician notification
- [x] Repair status updated -> customer notification
- [x] Additional repair found -> customer approval request
- [x] Customer approves/rejects -> technician/admin notification
- [x] Vehicle ready -> customer notification
- [x] Invoice generated -> customer notification
- [x] Payment completed -> customer and admin confirmation

### 5.3 Search, Filters & Audit Trail

  - [x] Global or module-specific search where appropriate
  - [x] Filter records by date, status, vehicle, customer, technician and service type
  - [x] Record important status changes with timestamps
  - [x] Record user who performed important administrative changes
  - [x] Maintain job and approval histories
