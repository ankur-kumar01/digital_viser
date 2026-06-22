# Support Ticket System Implementation Plan

Provide a brief description of the problem, any background context, and what the change accomplishes.
This plan outlines the end-to-end implementation of a production-grade Support Ticket system, allowing users to raise issues and communicate with the admin team interactively.

## Proposed Changes

### Database Migration
#### [NEW] `backend/migrations/044_support_tickets.js`
- Create `support_tickets` table: `id`, `user_id`, `subject`, `category`, `status` (open, pending, closed), `priority` (low, medium, high), `created_at`, `updated_at`.
- Create `support_ticket_messages` table: `id`, `ticket_id`, `sender_type` ('user', 'admin'), `sender_id`, `message`, `attachment_url`, `created_at`.

### Backend Implementation
#### [NEW] `backend/src/routes/support.js`
- User APIs: `POST /` (create ticket), `GET /` (list user tickets), `GET /:id` (get ticket details & messages), `POST /:id/reply` (reply to ticket), `PUT /:id/close` (close ticket).
#### [NEW] `backend/src/routes/adminSupport.js` (or integrated into `admin.js`)
- Admin APIs: `GET /` (list all tickets with filters), `GET /:id` (get ticket details & messages), `POST /:id/reply` (reply to ticket), `PUT /:id/status` (update status/priority).
#### [MODIFY] `backend/src/server.js`
- Register the new `/api/support` and `/api/admin/support` routes.

### Frontend Implementation
#### [NEW] `frontend/src/views/SupportTickets.tsx`
- User panel view listing their tickets with status badges and a "Create Ticket" button/modal.
#### [NEW] `frontend/src/views/SupportTicketDetail.tsx`
- Chat-style interface for the user to view ticket history and send replies to the admin.
#### [NEW] `frontend/src/views/admin/AdminSupportTickets.tsx`
- Admin panel view to list all tickets, sortable by status, priority, and date.
#### [NEW] `frontend/src/views/admin/AdminSupportTicketDetail.tsx`
- Admin interface to reply to tickets, change status to 'closed' or 'pending', and manage priority.
#### [MODIFY] `frontend/src/components/Sidebar.tsx`
- Add "Support Tickets" menu item for both User and Admin navigation.
#### [MODIFY] `frontend/src/App.tsx`
- Add the routing components for the new user and admin views.
#### [MODIFY] `frontend/src/api.ts`
- Add `supportAPI` and `adminSupportAPI` objects with necessary fetch methods.

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
- Create a test ticket as a user.
- View the ticket in the admin panel and reply to it.
- View the admin's reply in the user panel and send a follow-up.
- Test changing ticket status from the admin panel and closing the ticket from the user panel.
- Verify that closed tickets restrict new replies properly based on business logic.
