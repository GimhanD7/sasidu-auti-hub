# Vehicle service and repair project

The React frontend displays customer, administrator, and technician screens. The Express backend validates requests and stores workshop records in MongoDB.

## Following an action through the code

1. A page under `frontend/src/pages` holds form values in React state. Typing changes the form locally.
2. A submit, save, or delete handler sends a request through `frontend/src/lib/api.js`. This client includes the session cookie.
3. `backend/app.js` selects a router under `backend/routes`. Authentication and role middleware run where the route configures them.
4. A controller under `backend/controllers` checks input, record ownership, and workflow rules before making database changes.
5. Models under `backend/models` define stored fields, validation, indexes, and document hooks. A document's `save()` runs save hooks; direct database updates such as `updateOne()` do not run document save hooks.
6. The response supplies saved data or an error. The page updates its state or reloads data to show the result.

Comments beside important operations describe their purpose and side effects. Reading the route and controller together shows which permissions apply to an action.

## Important workflows

- **Accounts:** registration creates customer accounts. Login creates a random session token; MongoDB stores its hash. Password changes increment the account session version so older sessions are rejected.
- **Vehicles:** customer operations are scoped to the signed-in owner. A vehicle with appointments or service jobs cannot be permanently deleted through the customer delete action.
- **Service catalog:** deactivation stops new bookings. Deletion sets flags on the service record, preserving existing history.
- **Appointments:** booking keys reserve date/time slots. Cancellation and completion release the key. Reschedule requests and accepted schedule changes are separate workflow steps.
- **Jobs:** technician actions record work, parts, and labour. Completion prepares invoice data, records the final report, marks the job Ready, and updates the linked appointment.
- **Invoices:** drafts can be edited or removed. Finalizing issues a positive-value invoice as Pending. Draft deletion also removes the job's invoice reference.
- **Payments:** a customer submission awaits verification. A completed review contributes to the paid amount; a failed review does not settle the invoice.
- **Notifications:** several document hooks create notices after successful saves. Where delivery is best effort, notification failure does not reverse the saved business record.

## Environment and configuration

`backend/.env` contains local server settings. Keep its private values out of version control. `backend/.env.example` explains the shared setup keys without supplying private credentials. `frontend/.env.example` documents the public API host used by Vite. Values prefixed with `VITE_` are included in browser code and must not contain secrets.

Optional backend settings read by the application:

| Key | Purpose |
| --- | --- |
| `APPOINTMENT_BUSINESS_DAYS` | Comma-separated weekdays, 1 for Monday through 7 for Sunday; defaults to all seven days. |
| `APPOINTMENT_TIME_ZONE` | Workshop timezone for reminders and technician day summaries; defaults to `Asia/Colombo`. |
| `APPOINTMENT_REMINDER_HOURS` | Reminder lead time in hours; defaults to 24. |
| `TZ` | Process timezone and a fallback for reminder calculations when the appointment timezone is absent. |

JSON files do not support comments, so their purpose is documented here:

| File | Purpose |
| --- | --- |
| `backend/package.json` | Backend dependencies and start, watch, and test commands. |
| `frontend/package.json` | Frontend dependencies and development, build, test, lint, and formatting commands. |
| `frontend/.oxlintrc.json` | JavaScript/React lint configuration. |
| `frontend/.prettierrc.json` | Source formatting configuration. |
| Each `package-lock.json` | Generated dependency versions; maintained by npm. |

The `.gitignore` files control which local files and generated outputs Git excludes. Dependencies, build outputs, and static images are not application logic and are not annotated.

## Running checks

Run `npm test` in each of `backend` and `frontend`. In `frontend`, use `npm run build` to check the production bundle and `npm run lint` to check source rules. Tests under each project's `tests` directory describe the expected behavior in their test names and assertions.
